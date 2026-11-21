import { describe, expect, it } from 'vitest';
import type { FootageLayer } from '@tscaps/engine';
import type { FootageLayerFrameState, FootageLayerResolver } from '@tscaps/engine/advanced';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';
import { PreviewFootageBackdropStates } from '@presentation/shots/services/PreviewFootageBackdropStates';

/**
 * The states the preview's backdrop layers are in at a moment of
 * source time: asked of the resolver the preview draws with, at the
 * output time that moment plays at, the other layers left out.
 */

const STATE = (brightness: number): FootageLayerFrameState => ({
  assetRect: { x: 0, y: 0, width: 1, height: 1 },
  fit: 'cover',
  position: { x: { share: 0.5, offset: 0 }, y: { share: 0.5, offset: 0 } },
  cornerRadius: 0,
  opacity: 1,
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  blur: 0,
  brightness,
  clipInset: { top: 0, right: 0, bottom: 0, left: 0 },
  videoRect: null,
  videoAbove: false,
  videoCornerRadius: 0,
  backgroundColor: null,
  fillBlur: 0,
  clipRect: null,
  clipRadius: 0,
});
const layer = (id: string, kind: 'backdrop' | 'image'): FootageLayer => ({
  id,
  source: kind === 'backdrop' ? { kind } : { kind, blob: new Blob() },
  outputStartSec: 0,
  outputEndSec: 10,
  sourceStartSec: 0,
  sourcePassSec: Infinity,
});

function setup(layers: FootageLayer[]) {
  const asked: number[] = [];
  const resolver: FootageLayerResolver = {
    resolveAt: (outputSec) => {
      asked.push(outputSec);
      return layers.map((held, index) => ({ layer: held, state: STATE(index + 2) }));
    },
    dispose: () => {},
  };
  const footage = new ShotLayerPreviewFootageStore();
  footage.set({ layers, resolver, frame: null, outputEndSec: 10, grade: null });
  const store = new EditorStore();
  return { asked, store, states: new PreviewFootageBackdropStates(footage, store) };
}

describe('PreviewFootageBackdropStates', () => {
  it('answers the backdrops\' states alone, at the output time the source time plays at', () => {
    const { asked, store, states } = setup([layer('logo', 'image'), layer('transition', 'backdrop')]);
    store.patch({ cuts: store.snapshot().cuts.add({ startSec: 1, endSec: 2 }) });

    expect(states.statesAt(5).map((state) => state.brightness)).toEqual([3]);
    expect(asked).toEqual([4]);
  });

  it('asks nothing where no backdrop is drawn', () => {
    const { asked, states } = setup([layer('logo', 'image')]);

    expect(states.statesAt(5)).toEqual([]);
    expect(asked).toEqual([]);
  });
});
