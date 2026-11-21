import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import type { EditTake, EditTakes, FrameTakingLayer } from '@core/shots/services/EditTakes';

const OWN_CHANGES_UNREAD = 'The video\'s own camera changes could not be read here, so a take of the video may hold several of them: these are counted from the layers alone.';

/**
 * `get_takes`: the edit as a run of takes, each a stretch over which a
 * viewer sees one picture, with how long it is watched and which is the
 * longest stretch of the video's own picture. How often the picture
 * changes is the pace of an edit, and it cannot be read off the shots: a
 * shot opens for a zoom or a graphic too, which leave the picture as it
 * was.
 */
export class GetTakesOperation implements EditorOperation {
  readonly name = 'get_takes';
  readonly effect = 'read';
  readonly description = [
    'Read the pace of the edit: its takes in order, each a stretch over which the viewer sees one picture, with `seconds`, how long it is watched once the cuts are out.',
    'A take ends where the video itself changes camera, and where a b-roll, a picture or a graphic that takes the frame (laid out full or split) comes in or goes out: `picture` is "video" for the video in one framing of its own, or the ref of the layer that takes the frame.',
    'A zoom, a cut inside one framing, a caption or anything set over the video ends no take: the viewer is still looking at the same picture.',
    '`longestOfVideo` is the longest stretch of the video\'s own picture, which is where a b-roll is most missed. Times are seconds of the source video.',
    'Read it after placing b-rolls and pictures to see what stretch still runs long; `atLeastSec` lists only the takes of the video that long.',
  ].join(' ');

  private readonly input = new OperationInput({
    atLeastSec: z.number().min(0).optional().describe('List only the takes of the video\'s own picture watched for at least this many seconds. Left out: every take, the layers\' too.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly pictureChanges: PictureChangeReader,
    private readonly takes: EditTakes,
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return { ok: false, output: null, problems: checked.problems };
    const state = this.store.snapshot();
    if (!(state.video.duration > 0)) {
      return { ok: false, output: null, problems: [{ severity: 'error', message: 'No video is open in the editor yet: there are no takes to read.' }] };
    }
    const ownChanges = await this.ownChanges();
    const all = this.takes.of(state.video.duration, ownChanges ?? [], this.frameTakingLayers(), state.cuts.list());
    const ofVideo = all.filter((take) => take.layerId === null);
    const { atLeastSec } = checked.value;
    const listed = atLeastSec === undefined ? all : ofVideo.filter((take) => take.watchedSec >= atLeastSec);
    const longest = ofVideo.reduce<EditTake | null>((longer, take) => (longer === null || take.watchedSec > longer.watchedSec ? take : longer), null);
    const problems: OperationProblem[] = ownChanges === null ? [{ severity: 'warning', message: OWN_CHANGES_UNREAD }] : [];
    return {
      ok: true,
      output: {
        takes: listed.map((take) => this.row(take)),
        count: all.length,
        longestOfVideo: longest === null ? null : this.row(longest),
      },
      problems,
    };
  }

  /** Where the video's own picture changes, as the project knows it or as the reader finds it; null where it cannot be read. */
  private async ownChanges(): Promise<ReadonlyArray<number> | null> {
    const known = this.store.snapshot().video.pictureChangesSec;
    if (known !== null) return known;
    try {
      return await this.pictureChanges.read();
    } catch {
      // The video cannot be looked at here (no file behind it, or no decoder for it); the takes are still worth reading from the layers.
      return null;
    }
  }

  /** Every layer that takes the frame, full or split, or a video floated over its file, with the stretch it shows over. */
  private frameTakingLayers(): FrameTakingLayer[] {
    const { shots: partition } = this.store.snapshot();
    const shots = this.shots.shots();
    return shots.flatMap((shot) => shot.shot.layers.flatMap((layer) => {
      const placement = partition.placementOf(layer.id);
      if (placement.kind === 'inset' && placement.subject === 'asset') return [];
      const run = partition.runOf(layer.id);
      const last = shots.find((each) => each.shot.id === run[run.length - 1]?.id) ?? shot;
      return [{ layerId: layer.id, startSec: shot.startSec, endSec: last.endSec }];
    }));
  }

  private row(take: EditTake): Record<string, unknown> {
    return {
      fromSec: this.format.sec(take.startSec),
      toSec: this.format.sec(take.endSec),
      seconds: this.format.sec(take.watchedSec),
      picture: take.layerId === null ? 'video' : this.parser.formatOf('layer', take.layerId),
    };
  }
}
