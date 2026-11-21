import type { ColorGradeTelemetryReporter } from '@core/color-grade/services/ColorGradeTelemetryReporter';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ColorGrade, ColorGradeField } from '@core/color-grade/domain/ColorGrade';

/**
 * Grades the whole picture anew, or changes one of its adjustments.
 * Commits the previous state so the change participates in undo/redo; a
 * run of changes to one adjustment, such as a slider drag, is one undo
 * step. A grade equal to the current one changes nothing.
 */
export class SetColorGradeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: ColorGradeTelemetryReporter,
  ) {}

  /** Replaces the whole grade, as picking a look does. */
  execute(grade: ColorGrade): void {
    if (this.write(grade, 'Change color look', undefined)) this.telemetry.graded(grade);
  }

  /** Sets one adjustment, held inside its range. */
  setField(field: ColorGradeField, value: number): void {
    if (this.write(this.store.snapshot().colorGrade.with(field, value), 'Adjust color', `colorGrade:${field}`)) this.telemetry.adjusted(field);
  }

  /** Whether the grade changed. */
  private write(grade: ColorGrade, label: string, coalesceKey: string | undefined): boolean {
    if (grade.equals(this.store.snapshot().colorGrade)) return false;
    this.store.commit(label, coalesceKey);
    this.store.patch({ colorGrade: grade });
    return true;
  }
}
