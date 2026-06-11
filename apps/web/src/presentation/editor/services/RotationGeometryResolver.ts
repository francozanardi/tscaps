/**
 * Result of running a candidate rotation through the snap pass.
 * `snappedTo` is `null` when the candidate sits outside every snap
 * zone — consumers render the value as-is. When a snap fired the
 * field carries the canonical angle the value latched onto, which the
 * UI surfaces as a visual cue (icon colour change, chip badge).
 */
export interface RotationSnapResult {
  readonly value: number;
  readonly snappedTo: number | null;
}

const SNAP_ANGLES: readonly number[] = [-135, -90, -45, 0, 45, 90, 135, 180];
const SNAP_TOLERANCE_DEG = 4;

/**
 * Pure angle math for the overlay's rotation gestures.
 *
 * `deltaDegrees` returns the signed delta in degrees between the
 * vector from `pivot` to the pointerdown cursor and the vector from
 * `pivot` to the current cursor. Positive is clockwise in screen
 * coordinates (Y-down), so it composes directly onto the CSS
 * `rotate:` property value the consumer renders. The result is
 * wrapped into `(-180, 180]` so a small clockwise nudge from `170°`
 * past the seam reads as `-178°` rather than `+182°`.
 *
 * `snap` latches a candidate angle onto the nearest key angle
 * (0, ±45, ±90, ±135, 180) when it falls within ±4°. Outside every
 * snap zone the candidate passes through unchanged. The latch is
 * deliberately narrow so smooth free rotation away from key angles
 * stays uninterrupted; users who want pixel-precise non-key angles
 * sit just past the snap zone and rotate freely.
 */
export class RotationGeometryResolver {
  deltaDegrees(
    pivotX: number,
    pivotY: number,
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
  ): number {
    const startAngle = Math.atan2(startY - pivotY, startX - pivotX);
    const currentAngle = Math.atan2(currentY - pivotY, currentX - pivotX);
    const rawDegrees = ((currentAngle - startAngle) * 180) / Math.PI;
    return this.wrapSignedDegrees(rawDegrees);
  }

  snap(degrees: number): RotationSnapResult {
    const normalized = this.wrapSignedDegrees(degrees);
    for (const angle of SNAP_ANGLES) {
      if (Math.abs(this.wrapSignedDegrees(normalized - angle)) <= SNAP_TOLERANCE_DEG) {
        return { value: angle, snappedTo: angle };
      }
    }
    return { value: normalized, snappedTo: null };
  }

  private wrapSignedDegrees(degrees: number): number {
    const mod = ((degrees + 180) % 360 + 360) % 360;
    return mod - 180;
  }
}
