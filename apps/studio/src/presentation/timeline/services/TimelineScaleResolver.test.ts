import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { TimelineScaleResolver } from '@presentation/timeline/services/TimelineScaleResolver';

function createDocument(words: Word[]): Document {
  return new Document({
    sections: [
      new Section({
        segments: [
          new Segment({
            lines: [new Line({ words })],
          }),
        ],
        kind: 'main',
      }),
    ],
  });
}

describe('TimelineScaleResolver', () => {
  const resolver = new TimelineScaleResolver();

  it('calculates defaultPxPerSecond from video duration when document has no words', () => {
    const emptyDoc = createDocument([]);
    const pxPerSec = resolver.defaultPxPerSecond(emptyDoc, 800, 40);
    expect(pxPerSec).toBe(20); // 800 / 40
  });

  it('calculates defaultPxPerSecond from legible words when document has words', () => {
    const doc = createDocument([
      new Word({ text: 'word1', time: new TimeFragment(0, 0.4) }),
      new Word({ text: 'word2', time: new TimeFragment(0.4, 0.8) }),
    ]);
    const pxPerSec = resolver.defaultPxPerSecond(doc, 800, 40);
    expect(pxPerSec).toBeGreaterThan(0);
    expect(pxPerSec).not.toBe(20);
  });

  it('returns 0 defaultPxPerSecond when both words and video duration are absent', () => {
    const emptyDoc = createDocument([]);
    expect(resolver.defaultPxPerSecond(emptyDoc, 800, 0)).toBe(0);
  });

  it('returns rowDurationSec as panelWidthPx / pxPerSecond', () => {
    expect(resolver.rowDurationSec(800, 40)).toBe(20);
    expect(resolver.rowDurationSec(0, 40)).toBe(0);
    expect(resolver.rowDurationSec(800, 0)).toBe(0);
  });

  it('returns longestRowDurationSec matching video duration', () => {
    expect(resolver.longestRowDurationSec(120)).toBe(120);
    expect(resolver.longestRowDurationSec(0)).toBe(0);
  });

  it('returns median word duration for shortestRowDurationSec when words exist', () => {
    const doc = createDocument([
      new Word({ text: 'short', time: new TimeFragment(0, 0.2) }),
      new Word({ text: 'medium', time: new TimeFragment(1, 1.6) }),
      new Word({ text: 'long', time: new TimeFragment(2, 3.0) }),
    ]);
    expect(resolver.shortestRowDurationSec(doc)).toBeCloseTo(0.6);
  });

  it('falls back to 1 second for shortestRowDurationSec when document has no words', () => {
    const emptyDoc = createDocument([]);
    expect(resolver.shortestRowDurationSec(emptyDoc)).toBe(1);
  });
});
