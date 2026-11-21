import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { PlacedSourcePicture } from '@modules/video/SourcePicturePlacement';

/**
 * Produces one on-top raster per video frame — the layer the
 * compositor paints above the caption layer. Consumers use it to
 * occlude the captions with an effect (a person cutout, a
 * frame-locked decoration) whose pixels depend on the source frame.
 *
 * Lifecycle mirrors {@link SubtitleLayerSource}: {@link open} prepares
 * the source for a render at the given output dimensions,
 * {@link frameAt} services each video frame in the order the frames
 * are painted — monotonically advancing `time` for a transcode, any
 * order for single frames painted out of sequence, which a source handed
 * to such a painter must therefore answer — and {@link close} releases
 * resources. Open/close pairs
 * may repeat against the same instance, but a source cannot serve two
 * renders concurrently.
 *
 * `frameAt` returns `null` when this frame has no on-top layer to
 * paint; the compositor then skips the layer entirely for that frame.
 * `videoFrame` is the picture to cut from, at the output's size: as
 * composed, footage layers and grade included, or, where backdrop layers
 * draw it again, as it lay beneath them; `sourcePicture` says where the
 * source's own picture landed on it — re-framed, cropped, zoomed — so
 * anything measured on the source's picture can be drawn where it shows,
 * or null where a layer hides that picture entirely.
 */
export interface TopLayerSource {
  open(width: number, height: number): Promise<void>;

  frameAt(time: number, videoFrame: DecodedVideoFrame, sourcePicture: PlacedSourcePicture | null): Promise<OverlayFrame | null>;

  close(): void;
}
