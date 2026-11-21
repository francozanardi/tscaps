import type { FootageGrade } from '@tscaps/engine';

/** One adjustment of a grade. */
export type ColorGradeField = 'exposure' | 'contrast' | 'saturation' | 'temperature' | 'tint' | 'vignette';

/** A grade as it is stored. */
export type ColorGradeSnapshot = Readonly<Record<ColorGradeField, number>>;

const FIELDS: ReadonlyArray<ColorGradeField> = ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'vignette'];
const RANGES: Readonly<Record<ColorGradeField, readonly [number, number]>> = {
  exposure: [-1, 1],
  contrast: [-1, 1],
  saturation: [-1, 1],
  temperature: [-1, 1],
  tint: [-1, 1],
  vignette: [0, 1],
};
const NEUTRAL: ColorGradeSnapshot = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, vignette: 0 };

/**
 * The colour grade of the whole picture beneath the captions — the
 * video and everything shown over it — as the engine's `FootageGrade`
 * describes each adjustment. Immutable; every change returns a new
 * instance. Every value is held inside its range.
 */
export class ColorGrade {
  static neutral(): ColorGrade {
    return new ColorGrade(NEUTRAL);
  }

  /** Reads a stored grade, a missing or unreadable value taken as neutral and every other one held inside its range. */
  static fromSnapshot(snapshot: Partial<Record<ColorGradeField, unknown>> | null | undefined): ColorGrade {
    if (!snapshot) return ColorGrade.neutral();
    const values = Object.fromEntries(FIELDS.map((field) => [field, ColorGrade.held(field, snapshot[field])]));
    return new ColorGrade(values as ColorGradeSnapshot);
  }

  /** Every adjustment, in the order they are offered. */
  static fields(): ReadonlyArray<ColorGradeField> {
    return FIELDS;
  }

  /** The least and the most an adjustment can hold. */
  static rangeOf(field: ColorGradeField): readonly [number, number] {
    return RANGES[field];
  }

  private static held(field: ColorGradeField, value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    const [min, max] = RANGES[field];
    return Math.min(max, Math.max(min, value));
  }

  private constructor(private readonly values: ColorGradeSnapshot) {}

  valueOf(field: ColorGradeField): number {
    return this.values[field];
  }

  isNeutral(): boolean {
    return FIELDS.every((field) => this.values[field] === 0);
  }

  /** This grade with `field` at `value`, held inside its range. */
  with(field: ColorGradeField, value: number): ColorGrade {
    return new ColorGrade({ ...this.values, [field]: ColorGrade.held(field, value) });
  }

  equals(other: ColorGrade): boolean {
    return FIELDS.every((field) => this.values[field] === other.values[field]);
  }

  /** The grade as the engine draws it. */
  toFootageGrade(): FootageGrade {
    return this.values;
  }

  toSnapshot(): ColorGradeSnapshot {
    return this.values;
  }
}
