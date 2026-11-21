import type { ColorGrade, ColorGradeField } from '@core/color-grade/domain/ColorGrade';
import type { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';

const EVENT_CAP = 30;

/**
 * Reports how the picture is graded: each look picked, at most 30 a page
 * load, and each adjustment moved by hand, once per adjustment a page
 * load, since a slider reports every step of a drag.
 */
export class ColorGradeTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly budget: TelemetryBudget,
    private readonly looks: ColorGradeLooks,
  ) {}

  /** The whole grade was set to `grade`; reported when it is one of the looks offered. */
  graded(grade: ColorGrade): void {
    const look = this.looks.lookOf(grade);
    if (look === null || !this.budget.allows('color_grade_look_picked', EVENT_CAP)) return;
    this.telemetry.capture('color_grade_look_picked', { look: look.id });
  }

  adjusted(field: ColorGradeField): void {
    if (!this.budget.allows(`color_grade_adjusted:${field}`, 1)) return;
    this.telemetry.capture('color_grade_adjusted', { field });
  }
}
