import { RenderTimeMap } from '@tscaps/engine';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip, AudioClipRole } from '@core/audio-mix/domain/AudioClip';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

/** What a clip plays: a bundled sound by id, or a file of the media bin by id and name. */
interface SoundSourceReadout {
  readonly sound?: string;
  readonly mediaId?: string;
  readonly file?: string;
}

/**
 * Where one end of a clip lands: `sec` in seconds of the source video;
 * `inCut` where what it is placed on is cut away (`sec` is where the
 * cut collapses it to), `silentUntil` where it is on an emoji the
 * captions do not show now (`sec` is where it plays once they do): a
 * wait, by design, rather than a fault,
 * `gone` where what it was placed on no longer exists. `on` names what
 * it is placed on, `emoji` which emoji and word an emoji ref is, and
 * `offsetSec` how far from it, in seconds of the output.
 */
export interface SoundClipEdgeReadout {
  readonly sec?: number;
  readonly on: string;
  /** For a clip on an emoji, the emoji and the word holding it, as `🔥 on word:<id>`. */
  readonly emoji?: string;
  readonly offsetSec?: number;
  readonly inCut?: true;
  readonly silentUntil?: 'its emoji shows';
  readonly gone?: true;
}

/** A clip in a list. */
export interface SoundClipRow extends SoundSourceReadout {
  readonly ref: string;
  readonly role: AudioClipRole;
  readonly start: SoundClipEdgeReadout;
  readonly end?: SoundClipEdgeReadout;
  readonly volume: number;
  readonly loop?: true;
  /** How far it is lowered while somebody speaks, in decibels; absent while it is not. */
  readonly duckingDb?: number;
}

/** Everything about one clip. */
export interface SoundClipDetail extends SoundClipRow {
  readonly kind: 'sound';
  /** How long its file plays, in seconds; absent where the file is not known. */
  readonly fileSec?: number;
  readonly inSec: number;
  readonly fadeInSec: number;
  readonly fadeOutSec: number;
}

/**
 * Reads the soundtrack's clips for a read answer, with where each one
 * starts and ends on the source video's timeline, worked out from what
 * it is placed on (a word, an emoji, a shot, a layer, a transition, the video)
 * the way the preview and the export place it.
 */
export class SoundClipReadout {
  constructor(
    private readonly timing: AudioAnchorTiming,
    private readonly media: MediaAssetStore,
    private readonly builtinSounds: BuiltinSoundCatalog,
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
  ) {}

  /** Every clip of the soundtrack of `state`, in the order they were added. */
  rows(state: EditorState): SoundClipRow[] {
    const context = this.contextOf(state);
    return state.audio.clips().map((clip) => this.rowOf(clip, context));
  }

  /** Everything about `clip`, a clip of the soundtrack of `state`. */
  detail(clip: AudioClip, state: EditorState): SoundClipDetail {
    const fileSec = this.fileSecOf(clip);
    return {
      ...this.rowOf(clip, this.contextOf(state)),
      kind: 'sound',
      ...(fileSec === null ? {} : { fileSec: this.format.sec(fileSec) }),
      inSec: this.format.sec(clip.inSec),
      fadeInSec: this.format.sec(clip.fadeInSec),
      fadeOutSec: this.format.sec(clip.fadeOutSec),
    };
  }

  private rowOf(clip: AudioClip, context: AudioTimingContext): SoundClipRow {
    return {
      ref: this.parser.formatOf('sound', clip.id),
      role: clip.role,
      ...this.sourceOf(clip),
      start: this.edgeOf(clip.start, context),
      ...(clip.end === null ? {} : { end: this.edgeOf(clip.end, context) }),
      volume: this.format.share(clip.volume),
      ...(clip.loop ? { loop: true as const } : {}),
      ...(clip.ducking.enabled ? { duckingDb: clip.ducking.depthDb } : {}),
    };
  }

  private contextOf(state: EditorState): AudioTimingContext {
    const original = this.originalCaptions.read(state);
    return {
      originalDocument: original.document,
      originalSheets: original.sheets,
      originalDecorationOverrides: original.decorationOverrides,
      shots: state.shots,
      media: this.media.snapshot(),
      timeMap: new RenderTimeMap(state.cuts.list()),
      videoDurationSec: state.video.duration > 0 ? state.video.duration : 0,
    };
  }

  private sourceOf(clip: AudioClip): SoundSourceReadout {
    if (clip.source.kind === 'builtin') return { sound: clip.source.soundId };
    const asset = this.media.snapshot().get(clip.source.mediaId);
    return { mediaId: clip.source.mediaId, ...(asset === null ? {} : { file: asset.fileName }) };
  }

  private fileSecOf(clip: AudioClip): number | null {
    if (clip.source.kind === 'builtin') return this.builtinSounds.find(clip.source.soundId)?.lengthSec ?? null;
    return this.media.snapshot().get(clip.source.mediaId)?.durationSec ?? null;
  }

  private edgeOf(point: AudioAnchorPoint, context: AudioTimingContext): SoundClipEdgeReadout {
    const resolved = this.timing.resolve(point, context);
    const emoji = point.anchor.kind === 'emoji' ? this.emojiText(point.anchor.decorationId, context) : null;
    const placed = {
      on: this.anchorText(point.anchor),
      ...(emoji === null ? {} : { emoji }),
      ...(point.offsetSec === 0 ? {} : { offsetSec: this.format.sec(point.offsetSec) }),
    };
    if (resolved.kind === 'gone') return { ...placed, gone: true };
    const sec = this.format.sec(context.timeMap.toSourceTime(resolved.outputSec));
    if (resolved.kind === 'in-cut') return { sec, ...placed, inCut: true };
    return resolved.kind === 'hidden' ? { sec, ...placed, silentUntil: 'its emoji shows' } : { sec, ...placed };
  }

  /** The emoji `decorationId` names and the word holding it, read from the Original track; null where no word does. */
  private emojiText(decorationId: string, context: AudioTimingContext): string | null {
    const word = context.originalDocument?.getWords().find((candidate) => candidate.decoration?.id === decorationId);
    return word?.decoration ? `${word.decoration.glyph} on ${this.parser.formatOf('word', word.id)}` : null;
  }

  private anchorText(anchor: AudioAnchor): string {
    switch (anchor.kind) {
      case 'word':
        return `${this.parser.formatOf('word', anchor.wordId)} ${anchor.edge}`;
      case 'emoji':
        return this.parser.formatOf('decoration', anchor.decorationId);
      case 'shot':
        return `${this.parser.formatOf('shot', anchor.shotId)} ${anchor.edge}`;
      case 'transition':
        return `transition into ${this.parser.formatOf('shot', anchor.shotId)}`;
      case 'camera':
        return `camera of ${this.parser.formatOf('shot', anchor.shotId)}`;
      case 'layer-camera':
        return `camera of ${this.parser.formatOf('layer', anchor.layerId)}`;
      case 'layer':
        return `${this.parser.formatOf('layer', anchor.layerId)} ${anchor.edge}`;
      case 'layer-transition':
        return `${this.parser.formatOf('layer', anchor.layerId)} ${anchor.edge} transition`;
      case 'layer-moment':
        return `${this.parser.formatOf('layer', anchor.layerId)} moment ${anchor.momentId}`;
      case 'video':
        return `video ${anchor.edge}`;
    }
  }
}
