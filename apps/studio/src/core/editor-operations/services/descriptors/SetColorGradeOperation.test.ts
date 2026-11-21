import { describe, expect, it } from 'vitest';
import { SetColorGradeAction } from '@core/color-grade/actions/SetColorGradeAction';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SetColorGradeOperation } from '@core/editor-operations/services/descriptors/SetColorGradeOperation';
import { ColorGradeTelemetryReporter } from '@core/color-grade/services/ColorGradeTelemetryReporter';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';

/** A grade asked for by a program: a look, the adjustments given on top, and nothing for a look there is not. */

function setUp() {
  const store = new EditorStore();
  return { store, operation: new SetColorGradeOperation(store, new ColorGradeLooks(), new SetColorGradeAction(store, new ColorGradeTelemetryReporter({ capture: () => undefined }, new TelemetryBudget({ historyGroupAuthor: null }), new ColorGradeLooks()))) };
}

describe('set_color_grade', () => {
  it('starts from the look and sets the adjustments given on top of it', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({ look: 'warm', saturation: 0.3 });

    expect(store.snapshot().colorGrade.toSnapshot()).toEqual({ exposure: 0.05, contrast: 0, saturation: 0.3, temperature: 0.45, tint: 0, vignette: 0 });
    expect(result.output).toEqual({ look: null, grade: store.snapshot().colorGrade.toSnapshot() });
  });

  it('changes only the adjustments given when no look is named, and the none look takes the grade off', async () => {
    const { store, operation } = setUp();
    await operation.run({ look: 'moody' });

    await operation.run({ vignette: 0.2 });
    expect(store.snapshot().colorGrade.toSnapshot()).toMatchObject({ contrast: 0.3, saturation: -0.3, vignette: 0.2 });

    const result = await operation.run({ look: 'none' });
    expect(store.snapshot().colorGrade.isNeutral()).toBe(true);
    expect(result.output).toMatchObject({ look: 'none' });
  });

  it.each([
    ['a look there is not', { look: 'sepia' }, /not a look\. Looks: none, warm/],
    ['nothing to set', {}, /Give a look or at least one adjustment/],
    ['an adjustment out of range', { vignette: -0.5 }, /vignette/],
  ])('refuses %s, changing nothing', async (_, input, message) => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run(input);

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toMatch(message);
    expect(store.snapshot()).toBe(before);
  });
});
