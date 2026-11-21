import { ColorGrade, type ColorGradeSnapshot } from '@core/color-grade/domain/ColorGrade';

/** A named grade offered as a starting point: picking one sets every adjustment, which stay free to change after. */
export interface ColorGradeLook {
  readonly id: string;
  readonly label: string;
  readonly grade: ColorGrade;
}

const LOOKS: ReadonlyArray<{ id: string; label: string; values: Partial<ColorGradeSnapshot> }> = [
  { id: 'none', label: 'None', values: {} },
  { id: 'warm', label: 'Warm', values: { temperature: 0.45, saturation: 0.1, exposure: 0.05 } },
  { id: 'cool', label: 'Cool', values: { temperature: -0.45, tint: -0.1, contrast: 0.05 } },
  { id: 'vivid', label: 'Vivid', values: { saturation: 0.45, contrast: 0.2 } },
  { id: 'bright', label: 'Bright', values: { exposure: 0.3, contrast: -0.1, saturation: 0.1 } },
  { id: 'moody', label: 'Moody', values: { exposure: -0.15, contrast: 0.3, saturation: -0.3, vignette: 0.5 } },
  { id: 'matte', label: 'Matte', values: { contrast: -0.35, saturation: -0.15, exposure: 0.05 } },
  { id: 'vintage', label: 'Vintage', values: { temperature: 0.3, tint: 0.15, saturation: -0.3, contrast: -0.2, vignette: 0.35 } },
  { id: 'mono', label: 'Black & white', values: { saturation: -1, contrast: 0.15 } },
];

/** The looks offered, in order, *None* first. */
export class ColorGradeLooks {
  private readonly looks: ReadonlyArray<ColorGradeLook> = LOOKS.map(({ id, label, values }) => ({
    id,
    label,
    grade: ColorGrade.fromSnapshot(values),
  }));

  list(): ReadonlyArray<ColorGradeLook> {
    return this.looks;
  }

  /** The look `grade` is exactly, or null where it has been changed from every one. */
  lookOf(grade: ColorGrade): ColorGradeLook | null {
    return this.looks.find((look) => look.grade.equals(grade)) ?? null;
  }
}
