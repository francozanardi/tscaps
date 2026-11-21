import type { VideoLayout } from '@core/editor/domain/VideoState';

/** The shape of the output: the video's own, or a fixed one, written width:height. */
export type OutputFrameFormat = 'original' | '9:16' | '1:1' | '4:5' | '16:9';

/**
 * How the video enters a frame of another shape: `fill` covers the
 * frame and crops what falls outside it; `fit` shows the whole video,
 * leaving the rest of the frame to the backdrop.
 */
export type OutputFrameFit = 'fill' | 'fit';

/** What shows around a fitted video: black, or the video itself, blurred, covering the frame. */
export type OutputFrameBackdrop = 'black' | 'blur';

/**
 * Where a filled video sits in the frame, on each axis a share of the
 * part cropped away: `0` keeps the left (or top) edge, `0.5` centres
 * it, `1` keeps the right (or bottom) edge.
 */
export interface OutputFramePosition {
  readonly x: number;
  readonly y: number;
}

/** An output frame as it is stored. */
export interface OutputFrameSnapshot {
  readonly format: OutputFrameFormat;
  readonly fit: OutputFrameFit;
  readonly backdrop: OutputFrameBackdrop;
  readonly position: OutputFramePosition;
}

const FORMATS: ReadonlyArray<OutputFrameFormat> = ['original', '9:16', '1:1', '4:5', '16:9'];
const ASPECT_RATIOS: Readonly<Record<Exclude<OutputFrameFormat, 'original'>, number>> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
};
const CENTRED: OutputFramePosition = { x: 0.5, y: 0.5 };
// Shapes this close crop less than a pixel of any frame there is.
const SAME_SHAPE_TOLERANCE = 1e-4;

/**
 * The frame the video is exported in and previewed in, and how the
 * video sits in it. Immutable; every change returns a new instance.
 *
 * A frame of the video's own shape is the video as it is: its fit,
 * backdrop and position are kept, so a later change of shape finds
 * them, but nothing reads them.
 */
export class OutputFrame {
  static original(): OutputFrame {
    return new OutputFrame('original', 'fill', 'blur', CENTRED);
  }

  /** Reads a stored frame, falling back field by field to the original frame's where a value is missing or out of range. */
  static fromSnapshot(snapshot: Partial<OutputFrameSnapshot> | null | undefined): OutputFrame {
    const fallback = OutputFrame.original();
    if (!snapshot) return fallback;
    return new OutputFrame(
      FORMATS.includes(snapshot.format as OutputFrameFormat) ? snapshot.format! : fallback.format,
      snapshot.fit === 'fit' || snapshot.fit === 'fill' ? snapshot.fit : fallback.fit,
      snapshot.backdrop === 'black' || snapshot.backdrop === 'blur' ? snapshot.backdrop : fallback.backdrop,
      {
        x: OutputFrame.share(snapshot.position?.x),
        y: OutputFrame.share(snapshot.position?.y),
      },
    );
  }

  /** Every format, in the order they are offered. */
  static formats(): ReadonlyArray<OutputFrameFormat> {
    return FORMATS;
  }

  /** A format's width over its height; null for the video's own, which has none of its own. */
  static aspectRatioOf(format: OutputFrameFormat): number | null {
    return format === 'original' ? null : ASPECT_RATIOS[format];
  }

  private static share(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : CENTRED.x;
  }

  private constructor(
    readonly format: OutputFrameFormat,
    readonly fit: OutputFrameFit,
    readonly backdrop: OutputFrameBackdrop,
    readonly position: OutputFramePosition,
  ) {}

  isOriginal(): boolean {
    return this.format === 'original';
  }

  /**
   * The frame's size for a video of `video`'s size: the video's own for
   * the original shape. A fixed shape keeps the video's shorter side,
   * so a 1920×1080 video in 9:16 is 1080×1920; both sides are even, as
   * video encoders want. Null while the video's size is not known.
   */
  layoutFor(video: VideoLayout | null): VideoLayout | null {
    if (video === null || !(video.width > 0 && video.height > 0)) return null;
    if (this.format === 'original') return video;
    const aspectRatio = ASPECT_RATIOS[this.format];
    const shorterSide = this.even(Math.min(video.width, video.height));
    if (aspectRatio >= 1) return { width: this.even(shorterSide * aspectRatio), height: shorterSide };
    return { width: shorterSide, height: this.even(shorterSide / aspectRatio) };
  }

  /**
   * The axis a filled video of `video`'s size is cropped on: `x` for a
   * video wider than the frame, `y` for a taller one. Null where nothing
   * is cropped: a fitted video, the video's own shape, a frame of the
   * video's shape, or a video whose size is not known.
   */
  croppedAxis(video: VideoLayout | null): 'x' | 'y' | null {
    if (this.fit === 'fit' || this.format === 'original') return null;
    if (video === null || !(video.width > 0 && video.height > 0)) return null;
    const videoShape = video.width / video.height;
    const frameShape = ASPECT_RATIOS[this.format];
    if (Math.abs(videoShape / frameShape - 1) < SAME_SHAPE_TOLERANCE) return null;
    return videoShape > frameShape ? 'x' : 'y';
  }

  withFormat(format: OutputFrameFormat): OutputFrame {
    return new OutputFrame(format, this.fit, this.backdrop, this.position);
  }

  withFit(fit: OutputFrameFit): OutputFrame {
    return new OutputFrame(this.format, fit, this.backdrop, this.position);
  }

  withBackdrop(backdrop: OutputFrameBackdrop): OutputFrame {
    return new OutputFrame(this.format, this.fit, backdrop, this.position);
  }

  /** Each share clamped to `[0, 1]`. */
  withPosition(position: OutputFramePosition): OutputFrame {
    return new OutputFrame(this.format, this.fit, this.backdrop, {
      x: OutputFrame.share(position.x),
      y: OutputFrame.share(position.y),
    });
  }

  equals(other: OutputFrame): boolean {
    return this.format === other.format
      && this.fit === other.fit
      && this.backdrop === other.backdrop
      && this.position.x === other.position.x
      && this.position.y === other.position.y;
  }

  toSnapshot(): OutputFrameSnapshot {
    return { format: this.format, fit: this.fit, backdrop: this.backdrop, position: this.position };
  }

  private even(value: number): number {
    const rounded = Math.round(value);
    return Math.max(2, rounded % 2 === 0 ? rounded : rounded - 1);
  }
}
