import type { FootageGrade } from '@modules/video/grade/FootageGrade';

/** The grade's values, each held inside its range, and how strongly each one acts. */
export interface FootageGradeTerms {
  /** What each channel is multiplied by first: the exposure and the white balance. */
  readonly gain: readonly [number, number, number];
  /** How far from mid grey the contrast takes a value: 1 leaves it. */
  readonly contrast: number;
  /** How far from its grey the saturation takes a colour: 1 leaves it. */
  readonly saturation: number;
  /** How far the corners darken: 0 not at all. */
  readonly vignette: number;
  /** The share of the way from the centre to a corner where the darkening begins. */
  readonly vignetteStart: number;
}

// How far a full turn of the white balance moves a channel.
const WHITE_BALANCE_REACH = 0.15;
// The share of the way from the centre to a corner where the vignette starts.
const VIGNETTE_START = 0.45;

/**
 * Turns a grade into the terms every grader applies, in one order:
 * gain (exposure, then white balance), contrast about mid grey,
 * saturation about the colour's own luma (Rec. 709), then the vignette
 * by distance from the centre. Done on the stored values, as a picture's
 * own pixels are; clamped to `[0, 1]` at the end.
 */
export class FootageGradeMath {
  /** Whether `grade` changes nothing at all. */
  isNeutral(grade: FootageGrade): boolean {
    const terms = this.termsOf(grade);
    return terms.gain.every((value) => value === 1) && terms.contrast === 1 && terms.saturation === 1 && terms.vignette === 0;
  }

  termsOf(grade: FootageGrade): FootageGradeTerms {
    const exposure = 2 ** this.clamped(grade.exposure, -1, 1);
    const temperature = this.clamped(grade.temperature, -1, 1) * WHITE_BALANCE_REACH;
    const tint = this.clamped(grade.tint, -1, 1) * WHITE_BALANCE_REACH;
    return {
      gain: [exposure * (1 + temperature), exposure * (1 - tint), exposure * (1 - temperature)],
      contrast: 1 + this.clamped(grade.contrast, -1, 1),
      saturation: 1 + this.clamped(grade.saturation, -1, 1),
      vignette: this.clamped(grade.vignette, 0, 1),
      vignetteStart: VIGNETTE_START,
    };
  }

  private clamped(value: number, min: number, max: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
  }
}
