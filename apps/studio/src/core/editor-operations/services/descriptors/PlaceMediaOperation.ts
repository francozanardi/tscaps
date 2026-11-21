import { z } from 'zod';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { LayerRunWriter } from '@core/editor-operations/services/LayerRunWriter';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShowFileOnShotAction } from '@core/shots/actions/ShowFileOnShotAction';
import { ShotFileShowFailedError } from '@core/shots/domain/errors/ShotFileShowFailedError';
import type { ShotFileLayer, ShotLayer } from '@core/shots/domain/ShotLayer';

// A file named the way a ref is written; the id after it is what the media list holds.
const MEDIA_PREFIX = 'media:';

/**
 * `place_media`: shows one of the person's files on a shot, the way
 * dropping it on the shot does, and answers the layer that shows it.
 */
export class PlaceMediaOperation implements EditorOperation {
  readonly name = 'place_media';
  readonly effect = 'edit';
  readonly description = [
    'Show one of the person\'s files on a shot. A video becomes the shot\'s b-roll: where the shot already has one, that layer shows the new file instead, keeping its layout and motion, its timing starting over. A picture or GIF goes on top of the shot\'s files (graphics stay above it).',
    'The layer spans the whole shot, or with `through` every shot from that one through a later one, entering once and leaving once; it starts in the layout the last edited layer of its kind was left in (a b-roll covers the frame until one is changed).',
    '`media` is a file id from list_catalog (media). Audio files are sounds: use add_sounds. Change the layer\'s layout, or which part of a video plays, with set_layer on the layer answered.',
  ].join(' ');

  private readonly input = new OperationInput({
    shot: z.string().describe('The shot to show the file on, as a ref: shot:<id>.'),
    media: z.string().min(1).describe('The file\'s id, as list_catalog (media) gives it.'),
    through: z.string().optional().describe('The last shot the layer shows on, as a ref: shot:<id>, a shot after `shot`. Left out, it shows for `shot` alone; a b-roll already on the shot keeps how far it showed.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly shots: ShotRefResolver,
    private readonly media: MediaAssetStore,
    private readonly parser: EditorRefParser,
    private readonly showFile: ShowFileOnShotAction,
    private readonly runs: LayerRunWriter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const shot = this.shots.resolveShot(checked.value.shot);
    if (!shot.ok) return this.refused([shot.problem]);
    const file = this.fileOf(checked.value.media);
    if (!file.ok) return this.refused([file.problem]);
    const { through } = checked.value;
    const throughProblem = through === undefined ? null : this.runs.problemOf(shot.value, through);
    if (throughProblem !== null) return this.refused([throughProblem]);
    const before = shot.value.shot.layers;
    try {
      await this.showFile.execute(shot.value.shot.id, file.asset.id, 'assistant');
    } catch (error) {
      if (!(error instanceof ShotFileShowFailedError)) throw error;
      return this.refused([this.error(`This browser cannot play the GIF "${file.asset.fileName}", so it was not placed; pick another file.`)]);
    }
    const after = this.shots.resolveShot(shot.value.ref);
    const layer = after.ok ? this.layerShowing(file.asset, before, after.value.shot.layers) : null;
    if (layer === null) return this.refused([this.error(`Nothing changed: ${shot.value.ref} could not show "${file.asset.fileName}".`)]);
    const ref = this.parser.formatOf('layer', layer.id);
    const replaced = before.some((held) => held.id === layer.id);
    if (through !== undefined) this.runs.write(layer.id, through);
    return {
      ok: true,
      output: { layer: ref, type: file.asset.type, shot: shot.value.ref, ...this.runs.answerOf(layer.id, through !== undefined) },
      problems: replaced ? [this.replacedWarning(ref, shot.value.ref)] : [],
    };
  }

  /** The file `text` names in the media list, or why it cannot go on a shot. */
  private fileOf(text: string): { ok: true; asset: MediaAsset } | { ok: false; problem: OperationProblem } {
    const mediaId = text.startsWith(MEDIA_PREFIX) ? text.slice(MEDIA_PREFIX.length) : text;
    const asset = this.media.snapshot().get(mediaId);
    if (asset === null) {
      return { ok: false, problem: this.error(`No file has the id "${text}"; list_catalog (media) lists the person's files.`) };
    }
    if (asset.type === 'audio') {
      return { ok: false, problem: this.error(`"${asset.fileName}" is an audio file, which a shot cannot show; add it as a sound with add_sounds.`) };
    }
    return { ok: true, asset };
  }

  /**
   * The layer of `after` that placing `file` made: one showing it that was
   * not there before, or, for a video, the b-roll that took it in place of
   * its own file, keeping its id.
   */
  private layerShowing(file: MediaAsset, before: ReadonlyArray<ShotLayer>, after: ReadonlyArray<ShotLayer>): ShotFileLayer | null {
    const showing = after.filter((layer): layer is ShotFileLayer => 'mediaId' in layer && layer.mediaId === file.id);
    const heldBefore = new Set(before.map((layer) => layer.id));
    const added = showing.find((layer) => !heldBefore.has(layer.id));
    if (added !== undefined || file.type !== 'video') return added ?? null;
    return showing.find((layer) => heldBefore.has(layer.id)) ?? null;
  }

  private replacedWarning(layerRef: string, shotRef: string): OperationProblem {
    return {
      severity: 'warning',
      message: `${shotRef} already had a b-roll: ${layerRef} now shows this file instead, keeping its layout, its motion and how far it shows; its timing starts over (the whole file).`,
      ref: layerRef,
    };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
