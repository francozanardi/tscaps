import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@modules/video/RenderTimeMap';

const OPEN = Number.POSITIVE_INFINITY;

describe('RenderTimeMap.decodeSpans', () => {
  it('walks the whole source when nothing is cut', () => {
    const map = new RenderTimeMap([]);
    expect(map.decodeSpans(3)).toEqual([{ startSec: 0, endSec: OPEN }]);
  });

  it('stops before a long cut and resumes after it', () => {
    const map = new RenderTimeMap([{ startSec: 10, endSec: 100 }]);
    expect(map.decodeSpans(3)).toEqual([
      { startSec: 0, endSec: 10 },
      { startSec: 100, endSec: OPEN },
    ]);
  });

  it('reads through a cut too short to be worth seeking past', () => {
    const map = new RenderTimeMap([{ startSec: 10, endSec: 11 }]);
    expect(map.decodeSpans(3)).toEqual([{ startSec: 0, endSec: OPEN }]);
  });

  it('treats a cut exactly at the threshold as worth seeking past', () => {
    const map = new RenderTimeMap([{ startSec: 10, endSec: 13 }]);
    expect(map.decodeSpans(3)).toEqual([
      { startSec: 0, endSec: 10 },
      { startSec: 13, endSec: OPEN },
    ]);
  });

  it('starts at the end of a long cut that opens the source', () => {
    const map = new RenderTimeMap([{ startSec: 0, endSec: 90 }]);
    expect(map.decodeSpans(3)).toEqual([{ startSec: 90, endSec: OPEN }]);
  });

  it('keeps short cuts inside the span they fall in', () => {
    const map = new RenderTimeMap([
      { startSec: 10, endSec: 100 },
      { startSec: 120, endSec: 121 },
      { startSec: 200, endSec: 300 },
    ]);
    expect(map.decodeSpans(3)).toEqual([
      { startSec: 0, endSec: 10 },
      { startSec: 100, endSec: 200 },
      { startSec: 300, endSec: OPEN },
    ]);
  });

  it('does not emit an empty span between touching long cuts', () => {
    const map = new RenderTimeMap([
      { startSec: 10, endSec: 100 },
      { startSec: 100, endSec: 200 },
    ]);
    expect(map.decodeSpans(3)).toEqual([
      { startSec: 0, endSec: 10 },
      { startSec: 200, endSec: OPEN },
    ]);
  });

  it('orders spans by source position however the ranges arrived', () => {
    const map = new RenderTimeMap([
      { startSec: 200, endSec: 300 },
      { startSec: 10, endSec: 100 },
    ]);
    expect(map.decodeSpans(3)).toEqual([
      { startSec: 0, endSec: 10 },
      { startSec: 100, endSec: 200 },
      { startSec: 300, endSec: OPEN },
    ]);
  });

  it('walks the whole source when every cut is short', () => {
    const map = new RenderTimeMap([
      { startSec: 1, endSec: 2 },
      { startSec: 5, endSec: 6 },
    ]);
    expect(map.decodeSpans(3)).toEqual([{ startSec: 0, endSec: OPEN }]);
  });
});
