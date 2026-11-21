import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioAnchorResolution } from '@core/audio-mix/domain/AudioAnchorResolution';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { ResolvedShot } from '@core/shots/domain/ResolvedShot';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { AudioAnchorLabels } from '@presentation/audio-mix/services/AudioAnchorLabels';
import type { AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';
import type { SoundNames } from '@presentation/audio-mix/services/SoundNames';

/**
 * Whether a sound effect is heard: `heard` where its start lands on the
 * output, `in-cut` where what it is on is cut away, `hidden` where it is
 * on an emoji the captions do not show, `detached` where what it is on
 * no longer exists.
 */
export type AudioEffectState = 'heard' | 'in-cut' | 'hidden' | 'detached';

/** One sound effect as the Audio tab lists it. */
export interface AudioEffectRow {
  readonly clip: AudioClip;
  /** The sound's name, or its file's. */
  readonly name: string;
  /** What it is on, and where that plays. */
  readonly anchor: string;
  readonly state: AudioEffectState;
  /** The state as a status pill's word; null while the effect is heard. */
  readonly badge: string | null;
  /** Where the playhead goes to hear it, in source time; null where it plays nowhere. */
  readonly seekSourceSec: number | null;
  /** How far from what it is on it plays: `0.00s`, `+0.10s`, `−0.05s`. */
  readonly offsetLabel: string;
  readonly canNudgeEarlier: boolean;
  readonly canNudgeLater: boolean;
}

/**
 * A sound effect as an inspector's sound page lists it, in the part of
 * the element's life it plays at: `own` where that part is what it is
 * on, so the page added it; otherwise something else there plays it (a
 * camera, a transition, a word, a layer), named by the row's anchor.
 */
export interface SectionEffectRow {
  readonly row: AudioEffectRow;
  readonly own: boolean;
}

/** A shot's sound effects by when they play: at its start, during it, at its end. */
export interface ShotSoundSections {
  readonly start: readonly SectionEffectRow[];
  readonly during: readonly SectionEffectRow[];
  readonly end: readonly SectionEffectRow[];
}

/** The sound effects on one moment of a graphic layer, under the moment's name. */
export interface LayerMomentSoundSection {
  readonly momentId: string;
  /** The moment's name; its id where its code no longer declares it. */
  readonly label: string;
  /** False where the code no longer declares the moment: its sounds stay, and no more are added. */
  readonly declared: boolean;
  readonly rows: readonly SectionEffectRow[];
}

/** A layer's sound effects by when they play: at its two edges, and at each moment a graphic declares. */
export interface LayerSoundSections {
  readonly entrance: readonly SectionEffectRow[];
  /** A graphic's moments in the order they happen, then any its code no longer declares that still have sounds. */
  readonly moments: readonly LayerMomentSoundSection[];
  readonly exit: readonly SectionEffectRow[];
}

/** A row with where it lands, so rows can be put in the order they play. */
interface PlacedRow {
  readonly row: AudioEffectRow;
  readonly outputSec: number | null;
  readonly index: number;
}

const IN_POINT_STEP_SEC = 0.1;
const VIDEO_START: AudioAnchor = { kind: 'video', edge: 'start' };

/**
 * What the Audio tab shows and says apart from any control: the music,
 * the sound effects in the order they play and whether each is heard,
 * the names of the files they play, and the figures its sliders show.
 */
export class AudioTabPresenter {
  constructor(
    private readonly timing: AudioAnchorTiming,
    private readonly anchorLabels: AudioAnchorLabels,
    private readonly soundNames: SoundNames,
    private readonly offsets: AudioOffsetNudge,
  ) {}

  /** The project's music: its first music clip, or null where it has none. */
  musicOf(mix: AudioMix): AudioClip | null {
    return mix.clips().find((clip) => clip.role === 'music') ?? null;
  }

  /**
   * Every sound effect of `mix`, in the order the output plays them: by
   * where each starts, those added first first where two start
   * together. One in a cut sits where the cut collapses it; one whose
   * start is gone comes last, in the order it was added.
   */
  effectRows(mix: AudioMix, context: AudioTimingContext): readonly AudioEffectRow[] {
    const placed = mix.clips()
      .filter((clip) => clip.role === 'effect')
      .map((clip, index) => this.placedRowOf(clip, index, context));
    return placed.sort((first, second) => this.compare(first, second)).map((entry) => entry.row);
  }

  /**
   * The sound effects of `mix` that belong to `shot`, in the order
   * {@link effectRows} lists them: on its start or end, its camera, the
   * transition into it, its layers' edges and layout transitions, and
   * the words that start in it — the words its card shows as its own.
   */
  shotEffectRows(mix: AudioMix, context: AudioTimingContext, shot: ResolvedShot): readonly AudioEffectRow[] {
    const layerIds = new Set(shot.layers.map((layer) => layer.id));
    const wordIds = new Set(shot.pieces.filter((piece) => piece.startSec >= shot.startSec).map((piece) => piece.wordId));
    const emojiWordIds = this.emojiWordIdsOf(context);
    return this.effectRows(mix, context)
      .filter(({ clip }) => this.isOnShot(clip.start.anchor, shot.id, layerIds, wordIds, emojiWordIds));
  }

  /**
   * {@link shotEffectRows} by when they play: its start holds the sounds
   * on it, then its camera's and the transition into it's; its end, the
   * sounds on it; *during*, everything else of the shot (its words, its
   * layers). Each in play order.
   */
  shotSoundSections(mix: AudioMix, context: AudioTimingContext, shot: ResolvedShot): ShotSoundSections {
    const start: SectionEffectRow[] = [];
    const during: SectionEffectRow[] = [];
    const end: SectionEffectRow[] = [];
    for (const row of this.shotEffectRows(mix, context, shot)) {
      const { anchor } = row.clip.start;
      if (anchor.kind === 'shot' && anchor.shotId === shot.id) (anchor.edge === 'start' ? start : end).push({ row, own: true });
      else if ((anchor.kind === 'camera' || anchor.kind === 'transition') && anchor.shotId === shot.id) start.push({ row, own: false });
      else during.push({ row, own: false });
    }
    return { start: this.ownFirst(start), during, end };
  }

  /**
   * The sound effects of the layer `layerId` by when they play: at each
   * edge, the sounds on it, then its layout transition's there, and as it
   * enters, its camera's; at each moment its graphic declares, the sounds
   * on it, every moment listed whether it has sounds or not. Each in play
   * order.
   */
  layerSoundSections(mix: AudioMix, context: AudioTimingContext, layerId: string): LayerSoundSections {
    const entrance: SectionEffectRow[] = [];
    const exit: SectionEffectRow[] = [];
    const onMoments = new Map<string, SectionEffectRow[]>();
    for (const row of this.effectRows(mix, context)) {
      const { anchor } = row.clip.start;
      if (anchor.kind === 'layer' && anchor.layerId === layerId) (anchor.edge === 'entry' ? entrance : exit).push({ row, own: true });
      else if (anchor.kind === 'layer-transition' && anchor.layerId === layerId) (anchor.edge === 'entrance' ? entrance : exit).push({ row, own: false });
      else if (anchor.kind === 'layer-camera' && anchor.layerId === layerId) entrance.push({ row, own: false });
      else if (anchor.kind === 'layer-moment' && anchor.layerId === layerId) {
        onMoments.set(anchor.momentId, [...(onMoments.get(anchor.momentId) ?? []), { row, own: true }]);
      }
    }
    return { entrance: this.ownFirst(entrance), moments: this.momentSectionsOf(layerId, onMoments, context), exit: this.ownFirst(exit) };
  }

  /** What a clip's file is called: a bundled sound's name, or the user's file's name. */
  soundNameOf(source: AudioSourceRef, media: MediaAssetCatalog): string {
    return this.soundNames.nameOf(source, media);
  }

  /** A linear gain as the percentage a volume slider shows. */
  percentOf(gain: number): number {
    return Math.round(gain * 100);
  }

  /** A volume slider's percentage as a linear gain. */
  gainOf(percent: number): number {
    return percent / 100;
  }

  /** How far music is lowered under speech, as the positive number of decibels its slider shows. */
  loweringOf(depthDb: number): number {
    return Math.round(-depthDb);
  }

  /** A lowering slider's decibels as the depth a clip stores, negative. */
  depthOf(lowering: number): number {
    return lowering === 0 ? 0 : -lowering;
  }

  /**
   * Where in a file playback starts when the in-point is put at
   * `fraction` of its length, in tenths of a second, never at or past
   * its end.
   */
  inPointAt(fraction: number, lengthSec: number): number {
    if (!(lengthSec > 0)) return 0;
    const latest = Math.max(0, lengthSec - IN_POINT_STEP_SEC);
    const snapped = Math.round((Math.min(1, Math.max(0, fraction)) * lengthSec) / IN_POINT_STEP_SEC) * IN_POINT_STEP_SEC;
    return Number(Math.min(latest, snapped).toFixed(1));
  }

  /** The in-point moved by `steps` tenths of a second, kept inside the file. */
  inPointNudged(inSec: number, steps: number, lengthSec: number): number {
    return this.inPointAt((inSec + steps * IN_POINT_STEP_SEC) / lengthSec, lengthSec);
  }

  /** Where in its file the music starts, as minutes and seconds. */
  inPointLabel(inSec: number): string {
    return inSec <= 0 ? 'Starts at the beginning' : `Starts at ${this.anchorLabels.clockOf(inSec)}`;
  }

  musicEmptyLine(): string {
    return 'Add a song to play under the whole video.';
  }

  /**
   * Where an effect moved to the playhead plays: right at `outputSec`,
   * placed against the nearest start or end of an Original word that is
   * heard, so it keeps following the words, or failing one the nearest
   * start or end of a shot, with the offset that lands it there. Against
   * the video's start where neither exists.
   */
  pointAtPlayhead(context: AudioTimingContext, outputSec: number): AudioAnchorPoint {
    const wordAnchors = (context.originalDocument?.getWords() ?? []).flatMap((word): AudioAnchor[] => [
      { kind: 'word', wordId: word.id, edge: 'start' },
      { kind: 'word', wordId: word.id, edge: 'end' },
    ]);
    const shotAnchors = context.shots.list().flatMap((shot): AudioAnchor[] => [
      { kind: 'shot', shotId: shot.id, edge: 'start' },
      { kind: 'shot', shotId: shot.id, edge: 'end' },
    ]);
    return this.nearestPoint(wordAnchors, context, outputSec)
      ?? this.nearestPoint(shotAnchors, context, outputSec)
      ?? { anchor: VIDEO_START, offsetSec: this.rounded(outputSec) };
  }

  /** The offset of `point` moved by `steps` nudges, as {@link AudioOffsetNudge} moves it. */
  nudged(point: AudioAnchorPoint, steps: number): number {
    return this.offsets.nudged(point, steps);
  }

  effectsEmptyLine(): string {
    return 'Add a sound on a word, on a shot or on a layer.';
  }

  /** What the video sound's slider reads at 0, beside the section's name. */
  mutedBadge(): string {
    return 'Muted';
  }

  private placedRowOf(clip: AudioClip, index: number, context: AudioTimingContext): PlacedRow {
    const resolution = this.timing.resolve(clip.start, context);
    const state = this.stateOf(resolution);
    const outputSec = resolution.kind === 'gone' ? null : resolution.outputSec;
    return {
      row: {
        clip,
        name: this.soundNameOf(clip.source, context.media),
        anchor: this.anchorLabels.describe(clip.start.anchor, resolution, context),
        state,
        badge: this.badgeOf(state),
        seekSourceSec: outputSec === null ? null : context.timeMap.toSourceTime(Math.max(0, outputSec)),
        offsetLabel: this.offsets.labelOf(clip.start.offsetSec),
        canNudgeEarlier: this.offsets.canNudge(clip.start, -1),
        canNudgeLater: this.offsets.canNudge(clip.start, 1),
      },
      outputSec,
      index,
    };
  }

  private stateOf(resolution: AudioAnchorResolution): AudioEffectState {
    switch (resolution.kind) {
      case 'at':
        return 'heard';
      case 'in-cut':
        return 'in-cut';
      case 'hidden':
        return 'hidden';
      case 'gone':
        return 'detached';
    }
  }

  private badgeOf(state: AudioEffectState): string | null {
    switch (state) {
      case 'heard':
        return null;
      case 'in-cut':
        return 'In a cut';
      case 'hidden':
        return 'Emoji hidden';
      case 'detached':
        return 'Detached';
    }
  }

  /** The point on `anchors` nearest `outputSec`, among those heard; null where none is. */
  private nearestPoint(anchors: readonly AudioAnchor[], context: AudioTimingContext, outputSec: number): AudioAnchorPoint | null {
    let nearest: AudioAnchorPoint | null = null;
    for (const anchor of anchors) {
      const resolution = this.timing.resolve({ anchor, offsetSec: 0 }, context);
      if (resolution.kind !== 'at') continue;
      const offsetSec = this.rounded(outputSec - resolution.outputSec);
      if (nearest === null || Math.abs(offsetSec) < Math.abs(nearest.offsetSec)) nearest = { anchor, offsetSec };
    }
    return nearest;
  }

  private momentSectionsOf(
    layerId: string,
    onMoments: ReadonlyMap<string, readonly SectionEffectRow[]>,
    context: AudioTimingContext,
  ): LayerMomentSoundSection[] {
    const layer = context.shots.findLayer(layerId);
    const declared = layer !== null && 'graphic' in layer ? layer.graphic.moments : [];
    const declaredIds = new Set(declared.map((moment) => moment.id));
    return [
      ...declared.map((moment) => ({ momentId: moment.id, label: moment.label, declared: true, rows: onMoments.get(moment.id) ?? [] })),
      ...[...onMoments].filter(([momentId]) => !declaredIds.has(momentId))
        .map(([momentId, rows]) => ({ momentId, label: momentId, declared: false, rows })),
    ];
  }

  // A section's own sounds come before what others play there, each group keeping its play order.
  private ownFirst(rows: readonly SectionEffectRow[]): SectionEffectRow[] {
    return [...rows.filter((entry) => entry.own), ...rows.filter((entry) => !entry.own)];
  }

  private rounded(seconds: number): number {
    return Number(seconds.toFixed(2));
  }

  private isOnShot(
    anchor: AudioAnchor,
    shotId: string,
    layerIds: ReadonlySet<string>,
    wordIds: ReadonlySet<string>,
    emojiWordIds: ReadonlyMap<string, string>,
  ): boolean {
    switch (anchor.kind) {
      case 'shot':
      case 'camera':
      case 'transition':
        return anchor.shotId === shotId;
      case 'layer':
      case 'layer-transition':
      case 'layer-camera':
      case 'layer-moment':
        return layerIds.has(anchor.layerId);
      case 'word':
        return wordIds.has(anchor.wordId);
      case 'emoji':
        return wordIds.has(emojiWordIds.get(anchor.decorationId) ?? '');
      case 'video':
        return false;
    }
  }

  /** The word each emoji of the Original track is on, by the emoji's id. */
  private emojiWordIdsOf(context: AudioTimingContext): ReadonlyMap<string, string> {
    return new Map((context.originalDocument?.getWords() ?? [])
      .flatMap((word) => (word.decoration === null ? [] : [[word.decoration.id, word.id] as const])));
  }

  private compare(first: PlacedRow, second: PlacedRow): number {
    if (first.outputSec === null || second.outputSec === null) {
      if (first.outputSec !== second.outputSec) return first.outputSec === null ? 1 : -1;
      return first.index - second.index;
    }
    return first.outputSec - second.outputSec || first.index - second.index;
  }
}
