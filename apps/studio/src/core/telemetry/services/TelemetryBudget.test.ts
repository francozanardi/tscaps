import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';

describe('TelemetryBudget', () => {
  it('lets each key through up to its limit, and each key on its own count', () => {
    const budget = new TelemetryBudget(new EditorStore());

    const first = [1, 2, 3].map(() => budget.allows('shot_transition_set', 2));
    const other = budget.allows('shot_camera_set', 2);

    expect(first).toEqual([true, true, false]);
    expect(other).toBe(true);
  });

  it("keeps the assistant's count apart from the person's", async () => {
    const store = new EditorStore();
    const budget = new TelemetryBudget(store);
    let assistant: boolean[] = [];

    await store.withHistoryGroup({ key: 'agent-turn:1', author: 'assistant' }, () => {
      assistant = [1, 2].map(() => budget.allows('shot_transition_set', 1));
    });

    expect(assistant).toEqual([true, false]);
    expect(budget.allows('shot_transition_set', 1)).toBe(true);
  });
});
