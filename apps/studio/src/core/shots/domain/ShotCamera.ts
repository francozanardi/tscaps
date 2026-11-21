import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';

/** A camera's own variables, as its presets in the animation library declare them. */
export enum ShotCameraVariable {
  START_SCALE = '--layer-camera-start-scale',
  END_SCALE = '--layer-camera-end-scale',
  START_X = '--layer-camera-start-x',
  END_X = '--layer-camera-end-x',
  DURATION = '--layer-camera-duration',
  ANCHOR_X = '--layer-camera-anchor-x',
  ANCHOR_Y = '--layer-camera-anchor-y',
  INTENSITY = '--layer-camera-intensity',
}

/**
 * What a shot's camera does with the shot's own video, read off what
 * it was given: its camera preset (an animation of the library's
 * `camera` scope, with the values changed by hand over the preset's
 * own) and the shot's position fields, which say where it looks.
 * Immutable.
 *
 * The framings it starts and ends on are the preset's closeness, placed
 * where the shot's fields say, else where a pan's travel says, else
 * where the output frame crops (null). A preset that does not name an
 * end holds its start. A move of its own length names it
 * (`durationSec`); one over the whole shot does not.
 */
export class ShotCamera {
  /**
   * The camera of a shot whose video wears `fields` and `animation` at
   * its camera, `preset` being the animation's preset (null where it
   * has none, or names one the library does not hold).
   */
  static of(
    fields: ElementFieldValues | undefined,
    animation: ElementAnimation | undefined,
    preset: ElementAnimationPreset | null,
  ): ShotCamera {
    const value = (property: ShotCameraVariable): number | null => {
      const control = preset?.controls.find((candidate) => candidate.property === property);
      if (control === undefined) return null;
      const held = animation?.params[control.id] ?? control.defaultValue;
      return typeof held === 'number' && Number.isFinite(held) ? held : null;
    };
    const field = (id: string): number | null => {
      const held = fields?.[id];
      return typeof held === 'number' && Number.isFinite(held) ? held : null;
    };
    const startScale = value(ShotCameraVariable.START_SCALE) ?? 1;
    const endScale = value(ShotCameraVariable.END_SCALE) ?? startScale;
    const start = ShotVideoFraming.at(
      startScale,
      field(ShotVideoFraming.POSITION_FIELD_IDS.x) ?? value(ShotCameraVariable.START_X),
      field(ShotVideoFraming.POSITION_FIELD_IDS.y),
    );
    const end = ShotVideoFraming.at(
      endScale,
      field(ShotVideoFraming.END_POSITION_FIELD_IDS.x) ?? value(ShotCameraVariable.END_X) ?? start.x,
      field(ShotVideoFraming.END_POSITION_FIELD_IDS.y) ?? start.y,
    );
    const anchorX = value(ShotCameraVariable.ANCHOR_X);
    const anchorY = value(ShotCameraVariable.ANCHOR_Y);
    return new ShotCamera(
      animation?.presetId ?? null,
      start,
      end,
      value(ShotCameraVariable.DURATION),
      anchorX === null || anchorY === null ? null : { x: anchorX, y: anchorY },
      value(ShotCameraVariable.START_X) !== null,
      [ShotVideoFraming.POSITION_FIELD_IDS, ShotVideoFraming.END_POSITION_FIELD_IDS]
        .some((ids) => field(ids.x) !== null || field(ids.y) !== null),
      { x: [ShotVideoFraming.POSITION_FIELD_IDS.x, ShotVideoFraming.END_POSITION_FIELD_IDS.x].some((id) => field(id) !== null),
        y: [ShotVideoFraming.POSITION_FIELD_IDS.y, ShotVideoFraming.END_POSITION_FIELD_IDS.y].some((id) => field(id) !== null) },
    );
  }

  private constructor(
    /** The camera preset the shot was given, or null for none. */
    readonly presetId: string | null,
    readonly start: ShotVideoFraming,
    /** Where the camera has got to when its move ends; the start where it holds still. */
    readonly end: ShotVideoFraming,
    /** How long its move lasts from the shot's start; null for one over the whole shot, or none. */
    readonly durationSec: number | null,
    /** Where a momentary camera closes in, a share of the frame; null for one that names no point. */
    readonly anchor: { readonly x: number; readonly y: number } | null,
    /** Whether the camera travels across the picture by itself (a pan). */
    readonly pans: boolean,
    private readonly placed: boolean,
    private readonly ownShares: { readonly x: boolean; readonly y: boolean },
  ) {}

  /** Whether the camera's view changes over the shot: a zoom or a pan. */
  moves(): boolean {
    return !this.end.equals(this.start);
  }

  /**
   * Whether the shot keeps a share of its own on `axis`, so the output
   * frame's crop there does not move it: a position placed by hand, or
   * a pan's travel across.
   */
  holdsOwnShare(axis: 'x' | 'y'): boolean {
    return this.ownShares[axis] || (axis === 'x' && this.pans);
  }

  /** Whether the shot was given no camera and no position of its own. */
  isUntouched(): boolean {
    return this.presetId === null && !this.placed;
  }
}
