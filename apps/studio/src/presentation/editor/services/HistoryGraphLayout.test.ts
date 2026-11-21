import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { HistoryGraphLayout } from '@presentation/editor/services/HistoryGraphLayout';

const layout = new HistoryGraphLayout();

function edit(store: EditorStore, label: string): void {
  store.commit(label);
  store.patch({ hideBriefScenes: !store.snapshot().hideBriefScenes });
}

function rowsOf(store: EditorStore) {
  return layout.layOut(store.history()).rows.map((row) => ({
    title: row.checkpoint.title,
    lane: row.lane,
    shown: row.isShown,
    onShownPath: row.onShownPath,
  }));
}

describe('HistoryGraphLayout', () => {
  it('draws a history with no branch as one lane, newest first', () => {
    const store = new EditorStore();
    edit(store, 'A');
    edit(store, 'B');
    const graph = layout.layOut(store.history());
    expect(graph.laneCount).toBe(1);
    expect(rowsOf(store)).toEqual([
      { title: 'B', lane: 0, shown: true, onShownPath: true },
      { title: 'A', lane: 0, shown: false, onShownPath: true },
      { title: 'Start', lane: 0, shown: false, onShownPath: true },
    ]);
    expect(graph.rows[0]).toMatchObject({ lineAbove: false, lineBelow: true });
    expect(graph.rows[2]).toMatchObject({ lineAbove: true, lineBelow: false });
  });

  it('keeps what is shown in the first lane and moves the branch left behind to a lane of its own that joins where it forked', () => {
    const store = new EditorStore();
    edit(store, 'A');
    edit(store, 'B');
    store.undo();
    edit(store, 'C');

    const graph = layout.layOut(store.history());
    expect(graph.laneCount).toBe(2);
    expect(rowsOf(store)).toEqual([
      { title: 'C', lane: 0, shown: true, onShownPath: true },
      { title: 'B', lane: 1, shown: false, onShownPath: false },
      { title: 'A', lane: 0, shown: false, onShownPath: true },
      { title: 'Start', lane: 0, shown: false, onShownPath: true },
    ]);
    expect(graph.rows[1]).toMatchObject({ through: [0], lineBelow: true });
    expect(graph.rows[2]).toMatchObject({ joins: [1] });
  });

  it('keeps the changes a redo would bring back in the first lane, above the checkpoint shown', () => {
    const store = new EditorStore();
    edit(store, 'A');
    edit(store, 'B');
    store.undo();

    expect(rowsOf(store)).toEqual([
      { title: 'B', lane: 0, shown: false, onShownPath: false },
      { title: 'A', lane: 0, shown: true, onShownPath: true },
      { title: 'Start', lane: 0, shown: false, onShownPath: true },
    ]);
  });

  it('puts a branch in a lane another branch freed above it', () => {
    const store = new EditorStore();
    edit(store, 'A');
    store.undo();
    edit(store, 'B');
    edit(store, 'C');
    store.undo();
    store.undo();
    edit(store, 'D');

    const graph = layout.layOut(store.history());
    const laneOf = (title: string) => graph.rows.find((row) => row.checkpoint.title === title)?.lane;
    expect(laneOf('D')).toBe(0);
    expect(laneOf('B')).toBe(laneOf('C'));
    expect(graph.laneCount).toBe(3);
  });
});
