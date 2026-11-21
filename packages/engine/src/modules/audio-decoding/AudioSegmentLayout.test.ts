import { describe, expect, it } from 'vitest';
import { AudioSegmentLayout } from '@modules/audio-decoding/AudioSegmentLayout';

const SEGMENT_SECONDS = 60;
const MARGIN_SECONDS = 0.15;

describe('AudioSegmentLayout', () => {
  const layout = new AudioSegmentLayout(SEGMENT_SECONDS, MARGIN_SECONDS);

  it('trusts each segment for its own stretch, leaving no gap between them', () => {
    expect(layout.usableFrom(0)).toBe(0);
    expect(layout.usableFrom(1)).toBe(60);
    expect(layout.usableFrom(2)).toBe(120);
  });

  it('collects a margin of context on either side of that stretch', () => {
    expect(layout.collectsFrom(1)).toBeCloseTo(59.85, 5);
    expect(layout.endsAt(1)).toBeCloseTo(120.15, 5);
  });

  /**
   * Nothing precedes the first segment, so there is no earlier audio
   * to give it context and no timestamp it could start collecting at.
   */
  it('starts the first segment at the beginning of the track', () => {
    expect(layout.collectsFrom(0)).toBe(-Infinity);
    expect(layout.usableFrom(0)).toBe(0);
  });

  /**
   * An unsegmented layout is one segment covering everything. It runs
   * through the same arithmetic, where a segment length of Infinity
   * meets an index of zero.
   */
  it('describes a single segment covering the track when segments are unbounded', () => {
    const unsegmented = new AudioSegmentLayout(Infinity, MARGIN_SECONDS);

    expect(unsegmented.collectsFrom(0)).toBe(-Infinity);
    expect(unsegmented.usableFrom(0)).toBe(0);
    expect(unsegmented.endsAt(0)).toBe(Infinity);
  });
});
