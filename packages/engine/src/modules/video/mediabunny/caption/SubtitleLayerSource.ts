import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * Produces one caption raster per video frame for a render.
 *
 * Lifecycle is per-render: {@link open} prepares the source for a
 * specific document and style set, {@link frameAt} services each
 * video frame of that render in monotonically advancing `time`
 * order, and {@link close} releases the underlying resources.
 * Open/close pairs may repeat against the same instance, but a
 * source cannot serve two renders concurrently.
 */
export interface SubtitleLayerSource {
  /**
   * Prepares the source for a render at the given dimensions, scoped
   * to `styles` keyed by `Section.kind`.
   *
   * @param captionInterval Seconds between successive caption ticks.
   */
  open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    captionInterval: number,
  ): Promise<void>;

  /**
   * Resolves to the caption raster at `time`, or `null` when no
   * Section served by this source is active.
   *
   * @param time Presentation timestamp of `videoFrame` in seconds.
   * @param videoFrame Decoded video frame at `time`.
   */
  frameAt(time: number, videoFrame: DecodedVideoFrame): Promise<SubtitleFrame | null>;

  close(): void;
}
