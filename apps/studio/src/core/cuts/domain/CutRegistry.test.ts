import { describe, expect, it } from 'vitest';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';

describe('CutRegistry', () => {
  it('detects if a time is cut', () => {
    const cuts = CutRegistry.empty()
      .add({ startSec: 5, endSec: 10 })
      .add({ startSec: 20, endSec: 25 });

    expect(cuts.isCut(0)).toBe(false);
    expect(cuts.isCut(5)).toBe(true);
    expect(cuts.isCut(7.5)).toBe(true);
    expect(cuts.isCut(10)).toBe(false);
    expect(cuts.isCut(15)).toBe(false);
    expect(cuts.isCut(20)).toBe(true);
    expect(cuts.isCut(25)).toBe(false);
  });

  it('finds nextUncutTime', () => {
    const cuts = CutRegistry.empty()
      .add({ startSec: 5, endSec: 10 });

    expect(cuts.nextUncutTime(2)).toBe(2);
    expect(cuts.nextUncutTime(5)).toBe(10);
    expect(cuts.nextUncutTime(7)).toBe(10);
    expect(cuts.nextUncutTime(10)).toBe(10);
    expect(cuts.nextUncutTime(12)).toBe(12);
  });

  it('finds prevUncutTime', () => {
    const cuts = CutRegistry.empty()
      .add({ startSec: 5, endSec: 10 });

    expect(cuts.prevUncutTime(12)).toBe(12);
    expect(cuts.prevUncutTime(10)).toBe(5);
    expect(cuts.prevUncutTime(7)).toBe(5);
    expect(cuts.prevUncutTime(5)).toBe(5);
    expect(cuts.prevUncutTime(3)).toBe(3);
  });

  it('finds nextCutStart and prevCutEnd', () => {
    const cuts = CutRegistry.empty()
      .add({ startSec: 5, endSec: 10 })
      .add({ startSec: 20, endSec: 25 });

    expect(cuts.nextCutStart(2)).toBe(5);
    expect(cuts.nextCutStart(5)).toBe(20);
    expect(cuts.nextCutStart(10)).toBe(20);
    expect(cuts.nextCutStart(22)).toBe(null);

    expect(cuts.prevCutEnd(2)).toBe(null);
    expect(cuts.prevCutEnd(10)).toBe(null);
    expect(cuts.prevCutEnd(15)).toBe(10);
    expect(cuts.prevCutEnd(25)).toBe(10);
    expect(cuts.prevCutEnd(30)).toBe(25);
  });

  it('computes uncutSpans with various cut configurations', () => {
    const empty = CutRegistry.empty();
    expect(empty.uncutSpans(10)).toEqual([{ startSec: 0, endSec: 10 }]);
    expect(empty.uncutSpans(0)).toEqual([]);

    const cuts = CutRegistry.empty()
      .add({ startSec: 5, endSec: 10 })
      .add({ startSec: 20, endSec: 25 });

    expect(cuts.uncutSpans(30)).toEqual([
      { startSec: 0, endSec: 5 },
      { startSec: 10, endSec: 20 },
      { startSec: 25, endSec: 30 },
    ]);

    const cutAtStart = CutRegistry.empty().add({ startSec: 0, endSec: 5 });
    expect(cutAtStart.uncutSpans(20)).toEqual([{ startSec: 5, endSec: 20 }]);

    const cutAtEnd = CutRegistry.empty().add({ startSec: 15, endSec: 20 });
    expect(cutAtEnd.uncutSpans(20)).toEqual([{ startSec: 0, endSec: 15 }]);

    const entirelyCut = CutRegistry.empty().add({ startSec: 0, endSec: 20 });
    expect(entirelyCut.uncutSpans(20)).toEqual([]);
  });
});
