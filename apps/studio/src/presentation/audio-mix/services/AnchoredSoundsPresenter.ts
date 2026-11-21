import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotWordPiece } from '@core/shots/domain/ResolvedShot';
import { ORIGINAL_CAPTION_TRACK_ID } from '@core/translations/domain/CaptionTrack';
import type { AudioOffsetBounds, AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';
import type { SoundNames } from '@presentation/audio-mix/services/SoundNames';

/** One sound effect as it is listed beside what it is on. */
export interface AnchoredSoundView {
  readonly clip: AudioClip;
  readonly name: string;
  /** Its level, as the percentage a volume slider shows. */
  readonly volumePercent: number;
  /** How far from what it is on it plays: `0.00s`, `+0.10s`, `−0.05s`. */
  readonly nudgeLabel: string;
  readonly canNudgeEarlier: boolean;
  readonly canNudgeLater: boolean;
  /** Where on what it is on it plays, where that is not its start: `At the end of the word`; null otherwise. */
  readonly placeNote: string | null;
}

/**
 * The sound played on several anchors (some layers' entry, say), read
 * across all of them. A field that differs between them is *mixed*: the
 * first anchor's value shows, under a marker saying the rest differ.
 */
export interface SharedSoundView {
  /** Every sound effect on any of the anchors; empty where none has one. */
  readonly clipIds: readonly string[];
  /** The first sound's name, or null where no anchor has one. */
  readonly name: string | null;
  /** Some anchor plays another sound, or none. */
  readonly isNameMixed: boolean;
  readonly volumePercent: number;
  readonly isVolumeMixed: boolean;
  /** How far from its anchor the first sound plays, in seconds; negative is earlier. */
  readonly offsetSec: number;
  readonly isOffsetMixed: boolean;
}

/** What gives several anchors one sound: the clips to add and the ones they take the place of. */
export interface SharedSoundChange {
  readonly drafts: readonly AudioClipDraft[];
  readonly replacedClipIds: readonly string[];
}

/** A shot's edge and a layer's, the way an anchor names them. */
export type ShotSoundEdge = 'start' | 'end';
export type LayerSoundEdge = 'entry' | 'exit';

/**
 * What a sound looks like where it is added: beside a word, at a shot's
 * start or end, at a layer's entry or exit. It lists the sound effects
 * on one of those, says which words carry any, and builds the clips a
 * pick there adds.
 *
 * An effect is *on* something when its start anchor names it, at the
 * same edge; on a word, at either edge, since a word lists every sound
 * it carries and is marked for any of them. The nudge moves it by small steps ({@link AudioOffsetNudge}).
 */
export class AnchoredSoundsPresenter {
  constructor(
    private readonly soundNames: SoundNames,
    private readonly offsets: AudioOffsetNudge,
  ) {}

  /** The sound effects on `anchor`, in the order they were added. */
  soundsOn(mix: AudioMix, anchor: AudioAnchor, media: MediaAssetCatalog): readonly AnchoredSoundView[] {
    return this.effectsOn(mix, anchor).map((clip) => this.viewOf(clip, media));
  }

  /** How many sound effects are on `anchor`. */
  soundCountOn(mix: AudioMix, anchor: AudioAnchor): number {
    return this.effectsOn(mix, anchor).length;
  }

  /** The words some sound effect is on, by id, at either edge. */
  wordsWithSounds(mix: AudioMix): ReadonlySet<string> {
    const wordIds = new Set<string>();
    for (const clip of mix.clips()) {
      if (clip.role === 'effect' && clip.start.anchor.kind === 'word') wordIds.add(clip.start.anchor.wordId);
    }
    return wordIds;
  }

  /**
   * Whether a shot's piece of a word shows the mark of a word carrying
   * sounds: only the piece the word opens in, so a word a shot boundary
   * cuts through is marked once.
   */
  marksSound(piece: ShotWordPiece, shotStartSec: number, wordsWithSounds: ReadonlySet<string>): boolean {
    return wordsWithSounds.has(piece.wordId) && piece.startSec >= shotStartSec;
  }

  /**
   * Whether the transcript's words offer a sound: only while the
   * Original track is the one shown, since a sound is on a word of what
   * is said, never of a translation.
   */
  offersSoundsOnTranscriptWords(activeCaptionTrackId: string | null): boolean {
    return activeCaptionTrackId === null || activeCaptionTrackId === ORIGINAL_CAPTION_TRACK_ID;
  }

  /** The anchor of a word's start. */
  wordAnchor(wordId: string): AudioAnchor {
    return { kind: 'word', wordId, edge: 'start' };
  }

  shotAnchor(shotId: string, edge: ShotSoundEdge): AudioAnchor {
    return { kind: 'shot', shotId, edge };
  }

  /** The anchor of the layout transition the layer `layerId` plays at `edge`: its middle. */
  layerTransitionAnchor(layerId: string, edge: 'entrance' | 'exit'): AudioAnchor {
    return { kind: 'layer-transition', layerId, edge };
  }

  /** The anchor of the transition into `shotId`: its cut. */
  transitionAnchor(shotId: string): AudioAnchor {
    return { kind: 'transition', shotId };
  }

  /** The anchor of `shotId`'s camera move: the shot's start, for as long as the shot has a camera. */
  cameraAnchor(shotId: string): AudioAnchor {
    return { kind: 'camera', shotId };
  }

  /** The anchor of a shot layer's camera move: the layer's start, for as long as it has a camera. */
  layerCameraAnchor(layerId: string): AudioAnchor {
    return { kind: 'layer-camera', layerId };
  }

  layerAnchor(layerId: string, edge: LayerSoundEdge): AudioAnchor {
    return { kind: 'layer', layerId, edge };
  }

  /** The anchor of the moment `momentId` of the graphic layer `layerId`. */
  layerMomentAnchor(layerId: string, momentId: string): AudioAnchor {
    return { kind: 'layer-moment', layerId, momentId };
  }

  /** A sound effect playing `source` on `anchor`, right on it. */
  effectDraft(anchor: AudioAnchor, source: AudioSourceRef): AudioClipDraft {
    return { role: 'effect', source, start: { anchor, offsetSec: 0 } };
  }

  /** The offsets a layer's sound may play at from its edge, as a slider offers them. */
  layerOffsetBounds(): AudioOffsetBounds {
    return this.offsets.nearBounds();
  }

  /** The offset of `point` moved by `steps` nudges, as {@link AudioOffsetNudge} moves it. */
  nudged(point: AudioAnchorPoint, steps: number): number {
    return this.offsets.nudged(point, steps);
  }

  /**
   * The sound played on each of `anchors` (some layers' entry, say, or
   * their split line's slide), read across them all: the first anchor's
   * that has one, mixed where the anchors differ.
   */
  sharedSound(mix: AudioMix, anchors: readonly AudioAnchor[], media: MediaAssetCatalog): SharedSoundView {
    const firsts = anchors.map((anchor) => this.effectsOn(mix, anchor)[0] ?? null);
    const shown = firsts.find((clip) => clip !== null) ?? null;
    const clipIds = anchors.flatMap((anchor) => this.effectsOn(mix, anchor).map((clip) => clip.id));
    if (shown === null) {
      return { clipIds, name: null, isNameMixed: false, volumePercent: 100, isVolumeMixed: false, offsetSec: 0, isOffsetMixed: false };
    }
    return {
      clipIds,
      name: this.soundNames.nameOf(shown.source, media),
      isNameMixed: firsts.some((clip) => clip === null || !this.isSameSource(clip.source, shown.source)),
      volumePercent: this.percentOf(shown.volume),
      isVolumeMixed: firsts.some((clip) => clip !== null && clip.volume !== shown.volume),
      offsetSec: shown.start.offsetSec,
      isOffsetMixed: firsts.some((clip) => clip !== null && clip.start.offsetSec !== shown.start.offsetSec),
    };
  }

  /**
   * Gives every one of `anchors` the sound `source`: one new effect
   * each, in place of the ones played there, at the level and the offset
   * the first of those had.
   */
  sharedSoundChange(mix: AudioMix, anchors: readonly AudioAnchor[], source: AudioSourceRef): SharedSoundChange {
    const drafts: AudioClipDraft[] = [];
    const replacedClipIds: string[] = [];
    for (const anchor of anchors) {
      const held = this.effectsOn(mix, anchor);
      replacedClipIds.push(...held.map((clip) => clip.id));
      const offsetSec = held[0]?.start.offsetSec ?? 0;
      drafts.push({ role: 'effect', source, start: { anchor, offsetSec }, volume: held[0]?.volume ?? 1 });
    }
    return { drafts, replacedClipIds };
  }

  /** A linear gain as the percentage a volume slider shows. */
  percentOf(gain: number): number {
    return Math.round(gain * 100);
  }

  /** A volume slider's percentage as a linear gain. */
  gainOf(percent: number): number {
    return percent / 100;
  }

  private viewOf(clip: AudioClip, media: MediaAssetCatalog): AnchoredSoundView {
    return {
      clip,
      name: this.soundNames.nameOf(clip.source, media),
      volumePercent: this.percentOf(clip.volume),
      nudgeLabel: this.offsets.labelOf(clip.start.offsetSec),
      canNudgeEarlier: this.offsets.canNudge(clip.start, -1),
      canNudgeLater: this.offsets.canNudge(clip.start, 1),
      placeNote: clip.start.anchor.kind === 'word' && clip.start.anchor.edge === 'end' ? 'At the end of the word' : null,
    };
  }

  /** Every sound effect of `mix` placed on `anchor`. */
  effectsOn(mix: AudioMix, anchor: AudioAnchor): AudioClip[] {
    return mix.clips().filter((clip) => clip.role === 'effect' && this.isSameAnchor(clip.start.anchor, anchor));
  }

  private isSameAnchor(first: AudioAnchor, second: AudioAnchor): boolean {
    switch (first.kind) {
      case 'word':
        return second.kind === 'word' && second.wordId === first.wordId;
      case 'emoji':
        return second.kind === 'emoji' && second.decorationId === first.decorationId;
      case 'shot':
        return second.kind === 'shot' && second.shotId === first.shotId && second.edge === first.edge;
      case 'transition':
        return second.kind === 'transition' && second.shotId === first.shotId;
      case 'camera':
        return second.kind === 'camera' && second.shotId === first.shotId;
      case 'layer-camera':
        return second.kind === 'layer-camera' && second.layerId === first.layerId;
      case 'layer':
        return second.kind === 'layer' && second.layerId === first.layerId && second.edge === first.edge;
      case 'layer-transition':
        return second.kind === 'layer-transition' && second.layerId === first.layerId && second.edge === first.edge;
      case 'layer-moment':
        return second.kind === 'layer-moment' && second.layerId === first.layerId && second.momentId === first.momentId;
      case 'video':
        return second.kind === 'video' && second.edge === first.edge;
    }
  }

  private isSameSource(first: AudioSourceRef, second: AudioSourceRef): boolean {
    if (first.kind === 'media') return second.kind === 'media' && second.mediaId === first.mediaId;
    return second.kind === 'builtin' && second.soundId === first.soundId;
  }
}
