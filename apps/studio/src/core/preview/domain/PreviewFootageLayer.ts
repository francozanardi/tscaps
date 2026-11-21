import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';
import type { PreviewShownPicture } from '@core/preview/domain/PreviewShownPicture';

/**
 * Draws footage layers on stretches of the preview, each in the state
 * its footage answers for it, the way the export composes them. Positions are output
 * time. The host surface relays each of its gestures, and the layer
 * follows `time` while playing.
 *
 * Its presentation element sits over the host's inside the same
 * container. While a layer shows it carries the whole picture — the
 * host's own, read from `video` and re-framed where a layer asks, with
 * the layers drawn on it — and it is hidden wherever no layer covers
 * the moment on screen, or none of their pictures has arrived yet.
 * Emits `'change'` when that flips.
 */
export interface PreviewFootageLayer extends EventTarget {
  /**
   * Mounts over what `container` already holds; a later call re-parents.
   * `video` is the host's presentation element, which holds its picture.
   */
  mount(container: HTMLElement, time: PlaybackTimeSource, video: HTMLCanvasElement | HTMLVideoElement): void;
  unmount(): void;

  /** The pixel size of the host's picture, which the layers are framed in. */
  setFrameSize(widthPx: number, heightPx: number): void;
  /**
   * Replaces the footage and draws it again. A layer that plays the same
   * file at the same times keeps its decoder, however else it changed.
   */
  setFootage(footage: PreviewFootage): void;

  playFrom(outputSec: number): void;
  pause(): void;
  showStillAt(outputSec: number): void;
  beginScrub(): void;
  scrubTo(outputSec: number): void;
  endScrub(): void;
  /** Drops every decoder and hides the layer; the layers are kept. */
  clear(): void;

  isShowing(): boolean;

  /** Its canvas and where the video's own picture landed on the frame last drawn on it, while it shows; null otherwise. */
  shownPicture(): PreviewShownPicture | null;

  captureStream(): MediaStream | null;
}
