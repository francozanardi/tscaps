import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';

/** A part of the picture a framing is picked on, each side a share of the picture's (0 to 1). */
export interface ShotCameraFrameRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A point of that picture, or a share along each axis, each 0 to 1. */
export interface ShotCameraFramePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * How many output frames of video the picture a framing is picked on
 * spans, per axis: 1 where it is the frame itself, more along the axis
 * a filled frame crops the video on, where the picture is the whole
 * video.
 */
export interface ShotCameraFrameSpan {
  readonly x: number;
  readonly y: number;
}

const FRAME: ShotCameraFrameSpan = { x: 1, y: 1 };

/**
 * Turns a shot's framing into the part of the picture it keeps in view,
 * and back, for picking the framing on that picture. Held at `scale`,
 * the view is a `1 / (scale × span)` share of the picture along each
 * axis, placed by the framing's share of what is left out (`x`, `y`),
 * or by the frame's own crop (`frameShare`) where the framing names
 * none. This is what the stage draws: along an axis the frame crops a
 * filled video on, the share places the view on the whole video, as the
 * frame's crop does; elsewhere, on the frame.
 */
export class ShotCameraFrameGeometry {
  /** The part of the picture `framing` keeps in view. */
  rectOf(framing: ShotVideoFraming, frameShare: ShotCameraFramePoint, span: ShotCameraFrameSpan = FRAME): ShotCameraFrameRect {
    const width = this.sideOf(framing.scale, span.x);
    const height = this.sideOf(framing.scale, span.y);
    return {
      left: (framing.x ?? frameShare.x) * (1 - width),
      top: (framing.y ?? frameShare.y) * (1 - height),
      width,
      height,
    };
  }

  /** `framing` moved so its view is centred as near `centre` as the picture allows; an axis with nothing to move along keeps its share. */
  centredAt(framing: ShotVideoFraming, centre: ShotCameraFramePoint, span: ShotCameraFrameSpan = FRAME): ShotVideoFraming {
    return ShotVideoFraming.at(
      framing.scale,
      this.shareFor(centre.x, this.sideOf(framing.scale, span.x), framing.x),
      this.shareFor(centre.y, this.sideOf(framing.scale, span.y), framing.y),
    );
  }

  /** `framing` held at `scale`, its view kept centred where it was. */
  scaledTo(framing: ShotVideoFraming, scale: number, frameShare: ShotCameraFramePoint, span: ShotCameraFrameSpan = FRAME): ShotVideoFraming {
    const rect = this.rectOf(framing, frameShare, span);
    const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    return this.centredAt(ShotVideoFraming.at(scale, framing.x, framing.y), centre, span);
  }

  /** Whether `framing` has anywhere to move on the picture. */
  canMove(framing: ShotVideoFraming, span: ShotCameraFrameSpan = FRAME): boolean {
    return this.sideOf(framing.scale, span.x) < 1 || this.sideOf(framing.scale, span.y) < 1;
  }

  private sideOf(scale: number, span: number): number {
    return Math.min(1, 1 / (scale * span));
  }

  /** The share of what is left out that centres a view of `side` at `centre`; `held` where the view is the whole picture. */
  private shareFor(centre: number, side: number, held: number | null): number | null {
    if (side >= 1) return held;
    return Math.min(1 - side, Math.max(0, centre - side / 2)) / (1 - side);
  }
}
