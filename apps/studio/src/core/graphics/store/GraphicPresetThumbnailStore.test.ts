import { describe, expect, it } from 'vitest';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicFilmstrip, GraphicFilmstripRecorder } from '@core/graphics/services/GraphicFilmstripRecorder';
import { GraphicPresetThumbnailStore } from '@core/graphics/store/GraphicPresetThumbnailStore';

/**
 * A preset's loop is recorded once, at its own shape inside a wide card,
 * one recording at a time; one that cannot be recorded reads as failed
 * and is not tried again.
 */

function presetOf(id: string, aspectRatio: number): GraphicPreset {
  const graphic: Graphic = { document: { html: id, css: '', js: '' }, fields: [], params: {}, aspectRatio, moments: [], presetId: null, hidesCaptions: false };
  return { id, name: id, description: '', category: null, graphic, box: { kind: 'full' }, motion: { entrance: null, exit: null }, sounds: [], style: null };
}

/** Records whatever it is asked, after the test lets it, keeping what it was asked and how many ran at once. */
class GatedRecorder {
  readonly asked: Array<{ html: string; widthPx: number; heightPx: number }> = [];
  running = 0;
  mostAtOnce = 0;
  private releases: Array<() => void> = [];

  async record(graphic: Graphic, widthPx: number, heightPx: number): Promise<GraphicFilmstrip> {
    this.asked.push({ html: graphic.document.html, widthPx, heightPx });
    this.running += 1;
    this.mostAtOnce = Math.max(this.mostAtOnce, this.running);
    await new Promise<void>((resolve) => this.releases.push(resolve));
    this.running -= 1;
    if (graphic.document.html === 'broken') throw new Error('It does not play.');
    return { frames: [], frameSec: 1 / 12 };
  }

  async releaseAll(): Promise<void> {
    for (let round = 0; round < 10; round += 1) {
      const releases = this.releases.splice(0);
      for (const release of releases) release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

describe('GraphicPresetThumbnailStore', () => {
  it('records each preset once, one at a time, at its shape inside a wide card', async () => {
    const recorder = new GatedRecorder();
    const store = new GraphicPresetThumbnailStore(recorder as unknown as GraphicFilmstripRecorder);
    const bar = presetOf('bar', 40);
    const square = presetOf('square', 1);
    let heard = 0;
    store.subscribe(() => { heard += 1; });

    expect(store.thumbnailOf(bar).kind).toBe('waiting');
    expect(store.thumbnailOf(square).kind).toBe('waiting');
    store.thumbnailOf(bar);
    await recorder.releaseAll();

    expect(recorder.asked).toEqual([
      { html: 'bar', widthPx: 320, heightPx: 8 },
      { html: 'square', widthPx: 150, heightPx: 150 },
    ]);
    expect(recorder.mostAtOnce).toBe(1);
    expect(store.thumbnailOf(bar).kind).toBe('ready');
    expect(store.thumbnailOf(square).kind).toBe('ready');
    expect(heard).toBe(2);
  });

  it('reads a preset it cannot record as failed, and does not try again', async () => {
    const recorder = new GatedRecorder();
    const store = new GraphicPresetThumbnailStore(recorder as unknown as GraphicFilmstripRecorder);
    const broken = presetOf('broken', 2);

    store.thumbnailOf(broken);
    await recorder.releaseAll();
    store.thumbnailOf(broken);
    await recorder.releaseAll();

    expect(store.thumbnailOf(broken).kind).toBe('failed');
    expect(recorder.asked).toHaveLength(1);
  });

  it('does not record one given back before its turn, tells a card showing one given back, and records it again when asked again', async () => {
    const recorder = new GatedRecorder();
    const store = new GraphicPresetThumbnailStore(recorder as unknown as GraphicFilmstripRecorder);
    const first = presetOf('first', 1);
    const gone = presetOf('gone', 1);

    store.thumbnailOf(first);
    store.thumbnailOf(gone);
    store.release('gone');
    await recorder.releaseAll();
    expect(recorder.asked.map(({ html }) => html)).toEqual(['first']);

    let heard = 0;
    store.subscribe(() => { heard += 1; });
    store.release('first');
    store.release('never-asked');
    expect(heard).toBe(1);
    expect(store.thumbnailOf(first).kind).toBe('waiting');
    await recorder.releaseAll();
    expect(recorder.asked.map(({ html }) => html)).toEqual(['first', 'first']);
    expect(store.thumbnailOf(first).kind).toBe('ready');
  });
});
