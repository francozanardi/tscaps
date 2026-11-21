import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { Graphic } from '@core/graphics/domain/Graphic';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { RecordShotGraphicMomentsAction } from '@core/shots/actions/RecordShotGraphicMomentsAction';
import { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * What a graphic's code declares about its moments is kept on its layer,
 * so a sound on one lands without running the code; it is never a step of
 * its own to undo, and a run of an older version of the graphic never
 * overwrites what a newer one said.
 */

const GRAPHIC: Graphic = {
  document: { html: '<p></p>', css: '', js: 'tscaps.moment("press", 1.3)' },
  fields: [{ id: 'name', label: 'Name', kind: 'text', defaultValue: 'Your name' }],
  params: {},
  aspectRatio: 3,
  moments: [], presetId: null, hidesCaptions: false,
};

function setUp() {
  const store = new EditorStore();
  store.patch({ shots: ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [{ id: 'card', graphic: GRAPHIC }] }] }) });
  const action = new RecordShotGraphicMomentsAction(store, new GraphicSanitizer());
  const momentsOf = () => {
    const layer = store.snapshot().shots.findLayer('card');
    return layer !== null && 'graphic' in layer ? layer.graphic.moments : null;
  };
  return { store, action, momentsOf };
}

describe('RecordShotGraphicMomentsAction', () => {
  it('keeps the moments a run declared, checked and in the order they happen', () => {
    const { action, momentsOf } = setUp();

    action.record('card', GRAPHIC, [
      { id: 'like', label: 'Liked', sec: 2 },
      { id: 'press', label: 'Button pressed', sec: 1.3 },
      { id: 'bad id', label: 'Nope', sec: 1 },
    ]);

    expect(momentsOf()).toEqual([{ id: 'press', label: 'Button pressed', sec: 1.3 }, { id: 'like', label: 'Liked', sec: 2 }]);
  });

  it('is no step to undo', () => {
    const { store, action } = setUp();

    action.record('card', GRAPHIC, [{ id: 'press', label: 'Button pressed', sec: 1.3 }]);

    expect(store.snapshot().canUndo).toBe(false);
  });

  it('ignores a run of a graphic the layer no longer shows', () => {
    const { action, momentsOf } = setUp();

    action.record('card', { ...GRAPHIC, params: { name: 'Someone else' } }, [{ id: 'press', label: 'Button pressed', sec: 1.3 }]);
    action.record('card', { ...GRAPHIC, document: { ...GRAPHIC.document, js: '' } }, [{ id: 'press', label: 'Button pressed', sec: 1.3 }]);

    expect(momentsOf()).toEqual([]);
  });
});
