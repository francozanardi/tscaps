import { describe, expect, it } from 'vitest';
import { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';

describe('TimelineEditingController — holding scenes', () => {
  it('holds a scene together with the ones after it', () => {
    const editing = new TimelineEditingController();

    editing.selectSceneGroup('a', new Set(['a', 'b', 'c']));

    expect(editing.selectedSceneId).toBe('a');
    expect(editing.heldSceneIds).toEqual(new Set(['a', 'b', 'c']));
  });

  it('narrows the hold to one scene when another is taken', () => {
    const editing = new TimelineEditingController();
    editing.selectSceneGroup('a', new Set(['a', 'b']));

    editing.selectScene('b');

    expect(editing.heldSceneIds).toEqual(new Set(['b']));
  });

  it('lets go of the whole group when a stretch of video is selected', () => {
    const editing = new TimelineEditingController();
    editing.selectSceneGroup('a', new Set(['a', 'b']));

    editing.selectRange(1, 2);

    expect(editing.selectedSceneId).toBeNull();
    expect(editing.heldSceneIds.size).toBe(0);
  });

  it('hands back the same set until the hold changes', () => {
    const editing = new TimelineEditingController();
    editing.selectSceneGroup('a', new Set(['a', 'b']));
    const held = editing.heldSceneIds;

    editing.startSceneMove([]);

    expect(editing.heldSceneIds).toBe(held);
  });
});

describe('TimelineEditingController — a scene opened word by word', () => {
  const extent = { startSec: 2, endSec: 4 };

  it('opens one scene and lets go of whatever was held', () => {
    const editing = new TimelineEditingController();
    editing.selectSceneGroup('a', new Set(['a', 'b']));

    editing.openScene('b', extent);

    expect(editing.openedScene).toEqual({ segmentId: 'b', extent });
    expect(editing.heldSceneIds.size).toBe(0);
  });

  it('stays open for a press inside what it occupies, and a stretch selected there', () => {
    const editing = new TimelineEditingController();
    editing.openScene('a', extent);

    editing.startDrag(3);
    editing.selectRange(2.5, 3.5);
    editing.closeSceneIfOutside(4);

    expect(editing.openedScene?.segmentId).toBe('a');
  });

  it('closes for a press outside what it occupies', () => {
    const editing = new TimelineEditingController();
    editing.openScene('a', extent);

    editing.startDrag(5);

    expect(editing.openedScene).toBeNull();
  });

  it('closes when another scene is taken hold of, and not when it is taken itself', () => {
    const editing = new TimelineEditingController();
    editing.openScene('a', extent);
    editing.selectScene('a');
    expect(editing.openedScene?.segmentId).toBe('a');

    editing.selectScene('b');

    expect(editing.openedScene).toBeNull();
  });

  it('closes when scenes start being carried', () => {
    const editing = new TimelineEditingController();
    editing.openScene('a', extent);

    editing.startSceneMove([{
      segmentId: 'b',
      text: 'b',
      toneIndex: 0,
      window: { startSec: 5, endSec: 6 },
      extent: { startSec: 5, endSec: 6 },
      words: null,
    }]);

    expect(editing.openedScene).toBeNull();
  });
});
