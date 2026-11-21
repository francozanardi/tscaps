import type { EditorState } from '@core/editor/domain/EditorState';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import type { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/** A part of the source picture, each side a share of its width or height, 0 at the left or top. */
export interface PictureArea {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** How many output frames of picture there are along each axis: more than 1 along the axis a filled frame crops. */
export interface PictureSpan {
  readonly x: number;
  readonly y: number;
}

/**
 * Which part of the source picture a shot's own video shows, as a share
 * of the picture: the output frame's crop where the camera places
 * nothing of its own, the camera's framing where it does. Held at
 * `scale`, the view is `1 / (scale × span)` of the picture along each
 * axis, placed by the framing's share of what is left out.
 */
export class ShotPictureArea {
  constructor(private readonly presets: ElementAnimationCatalog) {}

  /** What a framing shows of the picture in the project as it stands. */
  areaOf(state: EditorState, framing: ShotVideoFraming): PictureArea {
    const span = this.spanOf(state);
    const width = Math.min(1, 1 / (framing.scale * span.x));
    const height = Math.min(1, 1 / (framing.scale * span.y));
    const position = state.outputFrame.position;
    return {
      left: (framing.x ?? position.x) * (1 - width),
      top: (framing.y ?? position.y) * (1 - height),
      width,
      height,
    };
  }

  /**
   * What the shot playing at `sec` shows at the start of its camera, and
   * at its end where the camera moves; null where no shot plays there.
   */
  shotAreaAt(state: EditorState, sec: number): { readonly start: PictureArea; readonly end: PictureArea } | null {
    const shot = state.shots.at(sec);
    if (shot === null) return null;
    const camera = this.cameraOf(state, shot.id);
    return { start: this.areaOf(state, camera.start), end: this.areaOf(state, camera.end) };
  }

  /**
   * The camera drawn on the shot `shotId`: its own video's, or that of
   * the earlier shot whose video runs through it; the whole frame where
   * there is none.
   */
  cameraOf(state: EditorState, shotId: string): ShotCamera {
    const drawnBy = state.shots.videoShotOf(shotId)?.id ?? shotId;
    const style = state.shots.layerStyles.get(ShotVideoLayerId.of(drawnBy));
    const animation = style?.animations?.[ElementAnimationScope.CAMERA];
    return ShotCamera.of(style?.fields, animation, animation?.presetId ? this.presets.byId(animation.presetId) : null);
  }

  /** The picture's span along each axis in the output frame. */
  spanOf(state: EditorState): PictureSpan {
    const video = state.video.layout;
    const frame = state.frameLayout;
    const axis = state.outputFrame.croppedAxis(video);
    if (axis === null || video === null || frame === null) return { x: 1, y: 1 };
    const videoShape = video.width / video.height;
    const frameShape = frame.width / frame.height;
    return axis === 'x' ? { x: videoShape / frameShape, y: 1 } : { x: 1, y: frameShape / videoShape };
  }
}
