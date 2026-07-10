import type { Document } from '@modules/document/Document';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * Produces one on-top raster per video frame — the layer the
 * compositor paints above the caption layer. Consumers use it to
 * occlude the captions with an effect (a person cutout, a
 * frame-locked decoration) whose pixels depend on the source frame.
 *
 * Lifecycle mirrors {@link SubtitleLayerSource}: {@link open} prepares
 * the source for a render, {@link frameAt} services each video frame
 * in monotonically advancing `time` order, and {@link close} releases
 * resources. Open/close pairs may repeat against the same instance,
 * but a source cannot serve two renders concurrently.
 *
 * `frameAt` returns `null` when this frame has no on-top layer to
 * paint; the compositor then skips the layer entirely for that frame.
 */
export interface TopLayerSource {
  open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    tickInterval: number,
  ): Promise<void>;

  frameAt(time: number, videoFrame: DecodedVideoFrame): Promise<OverlayFrame | null>;

  close(): void;
}
