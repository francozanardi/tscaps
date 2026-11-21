import { describe, expect, it } from 'vitest';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { CaptionlessSpanRefresher } from '@core/shots/services/CaptionlessSpanRefresher';

/** The captions are derived again when, and only when, where they are kept off changes. */

const HOOK = new BuiltinGraphicPresetCatalog().openingStarter().graphic;

function partition(hidesCaptions: boolean, secondShotSec = 2): ShotPartition {
  return ShotPartition.fromSnapshot({
    maxShotSec: 6,
    shots: [
      { id: 'a', startSec: 0, layers: [{ id: 'hook', graphic: { ...HOOK, hidesCaptions } }] },
      { id: 'b', startSec: secondShotSec, layers: [] },
    ],
  });
}

describe('CaptionlessSpanRefresher', () => {
  it('derives again when a graphic starts or stops hiding the captions, or its shot moves, and not otherwise', () => {
    const store = new EditorStore();
    store.patch({ shots: partition(false), video: { duration: 8 } });
    let refreshes = 0;
    const stop = new CaptionlessSpanRefresher(store, { execute: () => { refreshes += 1; } } as unknown as RefreshDocumentAction).start();

    store.patch({ shots: partition(true) });
    expect(refreshes).toBe(1);
    store.markDirty();
    store.patch({ shots: partition(true) });
    expect(refreshes).toBe(1);
    store.patch({ shots: partition(true, 3) });
    expect(refreshes).toBe(2);
    store.patch({ shots: partition(false, 3) });
    expect(refreshes).toBe(3);

    stop();
    store.patch({ shots: partition(true, 3) });
    expect(refreshes).toBe(3);
  });
});
