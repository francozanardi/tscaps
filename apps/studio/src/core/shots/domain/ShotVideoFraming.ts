import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';

/** One setting of a shot's framing: how close, or which part across or down is kept. */
export type ShotVideoFramingSetting = 'scale' | 'x' | 'y';

const MAX_SCALE = 3;

/**
 * One framing of a shot's camera: how much closer than the frame it holds
 * the video (`scale`, 1 or more) and which part of it is kept on each
 * axis (`x`, `y`, a share of the part cropped away: 0 the left or top
 * edge, 1 the right or bottom one), or null to keep where the output
 * frame crops. Immutable.
 */
export class ShotVideoFraming {
  /** The shot video's fields that say where its camera looks as it starts. */
  static readonly POSITION_FIELD_IDS: Readonly<Record<'x' | 'y', ElementFieldId>> = {
    x: ElementFieldId.PICTURE_X,
    y: ElementFieldId.PICTURE_Y,
  };

  /** The shot video's fields that say where its camera looks as its move ends. */
  static readonly END_POSITION_FIELD_IDS: Readonly<Record<'x' | 'y', ElementFieldId>> = {
    x: ElementFieldId.PICTURE_END_X,
    y: ElementFieldId.PICTURE_END_Y,
  };

  /** A framing of the given settings, each clamped to its range. */
  static at(scale: number, x: number | null, y: number | null): ShotVideoFraming {
    return new ShotVideoFraming(
      ShotVideoFraming.clamp(scale, 1, MAX_SCALE),
      x === null ? null : ShotVideoFraming.clamp(x, 0, 1),
      y === null ? null : ShotVideoFraming.clamp(y, 0, 1),
    );
  }

  /** The range a setting is kept within. */
  static rangeOf(setting: ShotVideoFramingSetting): readonly [number, number] {
    return setting === 'scale' ? [1, MAX_SCALE] : [0, 1];
  }



  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private constructor(
    readonly scale: number,
    readonly x: number | null,
    readonly y: number | null,
  ) {}

  /**
   * This framing aimed so the part it keeps in view is centred as near
   * `point` (shares of the frame) as the frame allows; the same framing
   * where nothing is cropped (`scale` 1), which has nothing to aim.
   */
  aimedAt(point: { readonly x: number; readonly y: number }): ShotVideoFraming {
    if (this.scale === 1) return this;
    const side = 1 / this.scale;
    const shareFor = (centre: number) => Math.min(1 - side, Math.max(0, centre - side / 2)) / (1 - side);
    return new ShotVideoFraming(this.scale, shareFor(point.x), shareFor(point.y));
  }

  /** Whether `other` holds the picture the same way. */
  equals(other: ShotVideoFraming): boolean {
    return this.scale === other.scale && this.x === other.x && this.y === other.y;
  }

  /** Whether the shot crops its video no differently from the output frame. */
  isAsFramed(): boolean {
    return this.scale === 1 && this.x === null && this.y === null;
  }
}
