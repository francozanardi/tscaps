import { describe, expect, it } from 'vitest';
import type { AudioEffectRow } from '@presentation/audio-mix/services/AudioTabPresenter';
import { HeldEffectRowOrder } from '@presentation/audio-mix/services/HeldEffectRowOrder';

/** Only the clip's id matters to the order. */
function row(clipId: string): AudioEffectRow {
  return { clip: { id: clipId } } as AudioEffectRow;
}

function idsOf(rows: readonly AudioEffectRow[]): string[] {
  return rows.map((entry) => entry.clip.id);
}

const order = new HeldEffectRowOrder();

describe('HeldEffectRowOrder', () => {
  it('keeps a row in place when its effect moves later in the video', () => {
    const playOrder = [row('b'), row('c'), row('a')];

    expect(idsOf(order.arrange(['a', 'b', 'c'], playOrder))).toEqual(['a', 'b', 'c']);
  });

  it('drops a removed row and keeps the rest in place', () => {
    expect(idsOf(order.arrange(['a', 'b', 'c'], [row('c'), row('a')]))).toEqual(['a', 'c']);
  });

  it('puts a new row after the row it follows in play order', () => {
    const playOrder = [row('a'), row('new'), row('b')];

    expect(idsOf(order.arrange(['b', 'a'], playOrder))).toEqual(['b', 'a', 'new']);
  });

  it('puts a new row first when it plays before every other', () => {
    expect(idsOf(order.arrange(['a', 'b'], [row('new'), row('a'), row('b')]))).toEqual(['new', 'a', 'b']);
  });

  it('shows play order when nothing was shown yet', () => {
    expect(idsOf(order.arrange([], [row('a'), row('b')]))).toEqual(['a', 'b']);
  });
});
