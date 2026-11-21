import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';

// A picture and a frame this close in shape crop nothing.
const SAME_SHAPE_TOLERANCE = 1e-4;

/**
 * How much of the source picture a shot's own video shows, as a share
 * of it on each axis: on the axis a filled frame crops, the frame's
 * share of the picture; on the other, all of it; both divided by how
 * close the shot's camera holds the picture.
 */
export class ShotFollowCrop {
  constructor(private readonly presets: ElementAnimationCatalog) {}

  /** The crop of the shot `shotId` of `shots`, for a picture of `pictureAspectRatio` in a frame of `frame`'s size. */
  of(shots: ShotPartition, shotId: string, pictureAspectRatio: number, frame: VideoLayout, outputFrame: OutputFrame): CropSize {
    const scale = Math.max(1, this.cameraOf(shots, shotId).start.scale);
    const frameShape = frame.width / frame.height;
    const filled = !outputFrame.isOriginal() && outputFrame.fit === 'fill' && Math.abs(pictureAspectRatio / frameShape - 1) >= SAME_SHAPE_TOLERANCE;
    const spanX = filled && pictureAspectRatio > frameShape ? pictureAspectRatio / frameShape : 1;
    const spanY = filled && pictureAspectRatio < frameShape ? frameShape / pictureAspectRatio : 1;
    return { width: Math.min(1, 1 / (scale * spanX)), height: Math.min(1, 1 / (scale * spanY)) };
  }

  private cameraOf(shots: ShotPartition, shotId: string): ShotCamera {
    const style = shots.layerStyles.get(ShotVideoLayerId.of(shotId));
    const animation = style?.animations?.[ElementAnimationScope.CAMERA];
    return ShotCamera.of(style?.fields, animation, animation?.presetId ? this.presets.byId(animation.presetId) : null);
  }
}
