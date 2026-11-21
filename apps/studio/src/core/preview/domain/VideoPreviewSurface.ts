import type { PreviewAudioMix } from '@core/preview/domain/PreviewAudioMix';
import type { PreviewShownPicture } from '@core/preview/domain/PreviewShownPicture';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';

/**
 * Which {@link VideoPreviewSurface} implementation to build:
 * - `canvas`: WebCodecs + `<canvas>` painter, driven by a preview
 *   proxy (480p H.264). Frame-accurate cut boundaries, best fit for
 *   sources whose codec the browser's WebCodecs pipeline supports.
 * - `native`: `<video>` element playing the source blob verbatim.
 *   Skips proxy generation entirely and inherits the browser's full
 *   codec support at the cost of frame-accurate cut precision.
 */
export type PreviewSurfaceVariant = 'canvas' | 'native';

/**
 * Intrinsic pixel size of the currently loaded video.
 */
export interface PreviewVideoSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Why the surface stopped showing its source.
 *
 * - `source-unreadable`: the bytes could not be read. They were
 *   readable once, or the file was never there; the same video from
 *   another copy plays.
 * - `unplayable`: the bytes were read and this browser cannot open or
 *   decode them; another copy of the same video fails the same way.
 */
export type PreviewLoadFailureReason = 'source-unreadable' | 'unplayable';

/**
 * Failure produced when opening a media file, decoding its first
 * frame, or reading it later while it plays. `message` is technical
 * text for logs and telemetry, never user-facing copy.
 */
export interface PreviewLoadFailure {
  readonly reason: PreviewLoadFailureReason;
  readonly message: string;
}

/**
 * Snapshot of a {@link VideoPreviewSurface}'s observable state.
 *
 * `currentTimeSec` is in **source time** — positions inside a cut
 * range are skipped over by the surface itself, so consumers never
 * observe a time that lands inside an active cut.
 *
 * `durationSec` is `null` whenever the surface does not know the
 * length: before a source opens, after it unloads, and when the one
 * it opened never reported a usable duration. A surface knows how
 * long its own playback runs; it is not the authority on how long the
 * file is, so it says "unknown" rather than naming a length it cannot
 * back — a zero here reads as a fact and erases the length the source
 * probe already established.
 */
export interface VideoPreviewSurfaceSnapshot {
  readonly currentTimeSec: number;
  readonly durationSec: number | null;
  readonly isPlaying: boolean;
  readonly volume: number;
  readonly playbackRate: number;
  readonly videoSize: PreviewVideoSize | null;
  readonly isReady: boolean;
  readonly loadFailure: PreviewLoadFailure | null;
}

/**
 * Renderer-agnostic media player abstraction. Plays a video file
 * onto a presentation element the surface owns, with audio routed
 * through a Web Audio graph the surface also owns.
 *
 * The surface is cut-aware: `seek` and natural playback advance in
 * source time, but positions inside an active cut range are skipped
 * over transparently. Consumers operate as if cuts simply did not
 * exist in the timeline.
 *
 * Lifecycle:
 * - `start(container)` creates the surface's presentation element
 *   (a `<canvas>`, a `<video>`, etc., depending on the impl) and
 *   attaches it to the given container. Subsequent calls with a
 *   different container re-parent the element without losing the
 *   loaded source. The consumer is responsible for the container's
 *   layout; the surface's element fills it.
 * - `load(source)` opens a video blob and prepares decoding. Throws
 *   when the codec is not decodable in this browser.
 * - `unload()` releases the decoders and clears the presentation.
 * - `stop()` tears the runtime down and detaches the presentation
 *   element; a later `start` rebuilds it.
 *
 * Emits three events:
 * - `'timechange'` — fired every time `currentTimeSec` advances
 *   during playback. High frequency.
 * - `'change'` — fired when any non-time field of the snapshot
 *   changes (play/pause, volume, rate, video size, ready, failure).
 * - `'footagechange'` — fired when footage layers start or stop
 *   showing over the picture.
 */
export interface VideoPreviewSurface extends EventTarget {
  start(container: HTMLElement): void;
  stop(): void;

  load(source: Blob): Promise<void>;
  unload(): void;

  play(): Promise<void>;
  pause(): void;
  seek(sourceTimeSec: number): void;
  setVolume(level: number): void;
  setPlaybackRate(rate: number): void;

  /**
   * Open an interactive scrub session. While the session is
   * open, every {@link seek} call is routed through a persistent
   * decoder dedicated to the drag, so the per-tick cost collapses
   * to one decode instead of one decoder + decode + teardown.
   * Pair with {@link endScrub} on pointer release.
   */
  beginScrub(): void;

  /**
   * Close the scrub session started with {@link beginScrub}. The
   * final seek target's frame is painted as part of teardown.
   * Safe to call without a matching {@link beginScrub}.
   */
  endScrub(): void;

  /**
   * Schedule the audio output to drop to silence the moment the
   * playhead reaches the given source-time position. Replaces any
   * pending schedule.
   */
  scheduleAudioMuteAt(sourceTimeSec: number): void;

  /** Cancel any pending scheduled mute and restore the output level. */
  cancelScheduledAudioMute(): void;

  /**
   * Stop playback the moment the playhead reaches the given
   * source-time position, coming to rest exactly on it rather than
   * wherever the stop was noticed, and restoring the output level.
   * Replaces any pending stop. The bound belongs to the run that is
   * playing: consumed on arrival, and dropped by {@link seek} or
   * {@link pause}. `canvas` paints no frame past it; `native` rests on
   * it just as exactly but cannot promise the frame.
   */
  scheduleStopAt(sourceTimeSec: number): void;

  /** Cancel any pending scheduled stop. Playback then runs on unbounded. */
  cancelScheduledStop(): void;

  /**
   * Draws footage layers on the picture over stretches of the output,
   * each in the state `footage` answers for it, as the export composes
   * them. Replaces the earlier footage; a layer playing the same file at
   * the same times keeps its decoder. Kept across `load` and `unload`.
   */
  setFootage(footage: PreviewFootage): void;

  /**
   * Mixes audio layers with the video's own sound while playing, each
   * where and as loud as the export mixes it, and sets the video's own
   * level. Replaces the earlier mix; while playing, what changed is
   * heard from now on, and a layer that only changed level plays on.
   * Every file is opened once. Kept across `load` and `unload`.
   *
   * The surface's volume and its scheduled mutes apply to the layers as
   * to the video's own sound. Layers play at the playback rate, pitch
   * shifted with it.
   */
  setAudioMix(mix: PreviewAudioMix): void;

  /**
   * Whether footage layers show over the picture right now, which is
   * when {@link captureFootageStream} carries the whole picture shown.
   * A flip fires `'footagechange'`.
   */
  isShowingFootage(): boolean;

  /**
   * The picture on screen right now, as pixels to sample, and where the
   * video's own picture landed on it: the footage's while it shows, the
   * video's own otherwise. Null where the surface has no picture it can
   * hand out, as a native `<video>` showing no footage.
   */
  shownPicture(): PreviewShownPicture | null;

  snapshot(): VideoPreviewSurfaceSnapshot;

  /** The video's own picture, never the footage drawn on it. */
  captureStream(): MediaStream | null;

  /** The picture with its footage layers drawn on it, meaningful while {@link isShowingFootage}. */
  captureFootageStream(): MediaStream | null;
}

/**
 * A {@link VideoPreviewSurface} that can change its concrete variant
 * mid-session. The playing rule is one-to-one: proxies play on the
 * canvas variant, raw sources on the native one, so which variant is
 * active follows from what the caller is about to load.
 *
 * Emits `'variantchange'` (on top of the base surface events) when
 * the active variant flips; `activeVariant` reads the current one.
 * A surface booted with a forced variant never switches and never
 * emits it.
 */
export interface SwitchableVideoPreviewSurface extends VideoPreviewSurface {
  readonly activeVariant: PreviewSurfaceVariant;

  /**
   * Aligns the active variant with the source about to be loaded:
   * canvas for a proxy blob, native for a raw source. Call before
   * {@link VideoPreviewSurface.load}; a needed switch tears the
   * current presentation down and stands the other variant up on the
   * same container, so the pending load lands on the right surface.
   */
  selectVariantForSource(isProxy: boolean): void;
}
