import { describe, expect, it } from 'vitest';
import { SetColorGradeAction } from '@core/color-grade/actions/SetColorGradeAction';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ColorGradeTelemetryReporter } from '@core/color-grade/services/ColorGradeTelemetryReporter';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import type { TelemetryEventProperties } from '@shared/telemetry';

/**
 * Grading the picture: a look sets every adjustment at once, one
 * adjustment moves alone and inside its range, a slider drag is one
 * undo step, and a look reads as picked only while nothing has moved
 * from it.
 */

const looks = new ColorGradeLooks();

type Captured = Array<[TelemetryEventName, TelemetryEventProperties | undefined]>;

function grading(store: EditorStore, events: Captured = []): SetColorGradeAction {
  const telemetry = { capture: (name: TelemetryEventName, properties?: TelemetryEventProperties) => { events.push([name, properties]); } };
  return new SetColorGradeAction(store, new ColorGradeTelemetryReporter(telemetry, new TelemetryBudget({ historyGroupAuthor: null }), looks));
}
const warm = looks.list().find((look) => look.id === 'warm')!;

describe('SetColorGradeAction', () => {
  it('grades the whole picture as a look, and reads that look back as picked', () => {
    const store = new EditorStore();

    grading(store).execute(warm.grade);

    expect(store.snapshot().colorGrade.equals(warm.grade)).toBe(true);
    expect(looks.lookOf(store.snapshot().colorGrade)?.id).toBe('warm');
  });

  it('moves one adjustment, held inside its range, and no look reads as picked after', () => {
    const store = new EditorStore();
    const action = grading(store);
    action.execute(warm.grade);

    action.setField('vignette', 3);

    expect(store.snapshot().colorGrade.valueOf('vignette')).toBe(1);
    expect(store.snapshot().colorGrade.valueOf('temperature')).toBe(warm.grade.valueOf('temperature'));
    expect(looks.lookOf(store.snapshot().colorGrade)).toBeNull();
  });

  it('takes a drag of one adjustment back in one undo step, and the look before it in another', () => {
    const store = new EditorStore();
    const action = grading(store);
    action.execute(warm.grade);
    for (const value of [0.1, 0.2, 0.3]) action.setField('exposure', value);

    store.undo();
    expect(store.snapshot().colorGrade.equals(warm.grade)).toBe(true);

    store.undo();
    expect(store.snapshot().colorGrade.isNeutral()).toBe(true);
  });

  it('changes nothing for the grade the picture already has', () => {
    const store = new EditorStore();

    grading(store).execute(ColorGrade.neutral());

    expect(store.snapshot().canUndo).toBe(false);
  });

  it('reads a stored grade back inside its ranges, an unreadable value as neutral', () => {
    const read = ColorGrade.fromSnapshot({ exposure: 4, contrast: 'high', vignette: -1 });

    expect(read.toSnapshot()).toEqual({ exposure: 1, contrast: 0, saturation: 0, temperature: 0, tint: 0, vignette: 0 });
  });

  it('reports a look picked, and each adjustment moved once a page load, never a grade left as it was', () => {
    const store = new EditorStore();
    const events: Captured = [];
    const action = grading(store, events);

    action.execute(warm.grade);
    action.execute(warm.grade);
    for (const value of [0.1, 0.2, 0.3]) action.setField('exposure', value);
    action.setField('contrast', 0.4);

    expect(events).toEqual([
      ['color_grade_look_picked', { look: 'warm' }],
      ['color_grade_adjusted', { field: 'exposure' }],
      ['color_grade_adjusted', { field: 'contrast' }],
    ]);
  });
});
