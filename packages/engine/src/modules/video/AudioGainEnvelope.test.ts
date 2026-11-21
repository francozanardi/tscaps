import { describe, expect, it } from 'vitest';
import { AudioGainEnvelope, type AudioGainBreakpoint, type AudioGainEnvelopeBounds } from '@modules/video/AudioGainEnvelope';
import type { AudioLayer } from '@modules/video/AudioLayer';

const LONG: AudioGainEnvelopeBounds = { outputDurationSec: 100, sourceDurationSec: 100 };

function layer(overrides: Partial<AudioLayer>): AudioLayer {
  return {
    id: 'layer',
    source: new Blob([]),
    outputStartSec: 0,
    outputEndSec: 10,
    sourceStartSec: 0,
    sourcePassSec: Number.POSITIVE_INFINITY,
    gain: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    duck: null,
    ...overrides,
  };
}

/**
 * What a Web Audio gain parameter plays when the first breakpoint is set
 * outright and every later one is a linear ramp ending at its time.
 */
function scheduledValueAt(points: ReadonlyArray<AudioGainBreakpoint>, timeSec: number): number {
  let value = points[0]!.gain;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!;
    const to = points[index]!;
    if (timeSec < to.timeSec) {
      if (to.timeSec === from.timeSec) return value;
      return from.gain + ((to.gain - from.gain) * (timeSec - from.timeSec)) / (to.timeSec - from.timeSec);
    }
    value = to.gain;
  }
  return value;
}

describe('AudioGainEnvelope', () => {
  it('rises from silence at the start to the layer gain at the end of the fade in', () => {
    const envelope = new AudioGainEnvelope(layer({ outputStartSec: 2, gain: 0.8, fadeInSec: 1 }), LONG);
    expect(envelope.gainAt(2)).toBe(0);
    expect(envelope.gainAt(2.5)).toBeCloseTo(0.4, 12);
    expect(envelope.gainAt(3)).toBeCloseTo(0.8, 12);
    expect(envelope.gainAt(6)).toBeCloseTo(0.8, 12);
  });

  it('lands the fade out on silence at the layer end', () => {
    const envelope = new AudioGainEnvelope(layer({ outputEndSec: 4, fadeOutSec: 2 }), LONG);
    expect(envelope.gainAt(2)).toBeCloseTo(1, 12);
    expect(envelope.gainAt(3)).toBeCloseTo(0.5, 12);
    expect(envelope.gainAt(3.999)).toBeCloseTo(0.0005, 9);
    expect(envelope.gainAt(4)).toBe(0);
  });

  it('shrinks fades longer than the stretch in proportion so they meet', () => {
    const envelope = new AudioGainEnvelope(layer({ outputEndSec: 2, fadeInSec: 3, fadeOutSec: 1 }), LONG);
    expect(envelope.gainAt(1.5)).toBeCloseTo(1, 12);
    expect(envelope.gainAt(0.75)).toBeCloseTo(0.5, 12);
    expect(envelope.gainAt(1.75)).toBeCloseTo(0.5, 12);
  });

  it('is lowered by the duck over a range, ramping down before it and back up after it', () => {
    const duck = { ranges: [{ startSec: 4, endSec: 6 }], gain: 0.25, attackSec: 0.5, releaseSec: 1 };
    const envelope = new AudioGainEnvelope(layer({ gain: 0.8, duck }), LONG);
    expect(envelope.gainAt(3.5)).toBeCloseTo(0.8, 12);
    expect(envelope.gainAt(3.75)).toBeCloseTo(0.8 * 0.625, 12);
    expect(envelope.gainAt(4)).toBeCloseTo(0.2, 12);
    expect(envelope.gainAt(6)).toBeCloseTo(0.2, 12);
    expect(envelope.gainAt(6.5)).toBeCloseTo(0.8 * 0.625, 12);
    expect(envelope.gainAt(7)).toBeCloseTo(0.8, 12);
  });

  it('stays down between ranges closer than the attack and the release together', () => {
    const duck = {
      ranges: [{ startSec: 6.2, endSec: 7 }, { startSec: 4, endSec: 6 }],
      gain: 0.5,
      attackSec: 0.1,
      releaseSec: 0.15,
    };
    const envelope = new AudioGainEnvelope(layer({ duck }), LONG);
    expect(envelope.gainAt(6.1)).toBeCloseTo(0.5, 12);
    expect(envelope.gainAt(7.15)).toBeCloseTo(1, 12);
  });

  it('steps down at a range start when the duck has no attack', () => {
    const duck = { ranges: [{ startSec: 4, endSec: 6 }], gain: 0.5, attackSec: 0, releaseSec: 0 };
    const envelope = new AudioGainEnvelope(layer({ duck }), LONG);
    expect(envelope.gainAt(3.9999)).toBe(1);
    expect(envelope.gainAt(4)).toBe(0.5);
    expect(envelope.gainAt(5.9999)).toBe(0.5);
    expect(envelope.gainAt(6)).toBe(1);
  });

  it('stops where a source played once runs out, before its stretch ends', () => {
    const envelope = new AudioGainEnvelope(
      layer({ outputStartSec: 1, outputEndSec: Number.POSITIVE_INFINITY, sourceStartSec: 0.5 }),
      { outputDurationSec: 20, sourceDurationSec: 2 },
    );
    expect(envelope.endSec).toBeCloseTo(2.5, 12);
    expect(envelope.gainAt(2.49)).toBe(1);
    expect(envelope.gainAt(2.5)).toBe(0);
  });

  it('runs a source that starts over until its stretch or the output ends', () => {
    const looping = layer({ outputEndSec: Number.POSITIVE_INFINITY, sourcePassSec: 1 });
    expect(new AudioGainEnvelope(looping, { outputDurationSec: 20, sourceDurationSec: 2 }).endSec).toBe(20);
    expect(new AudioGainEnvelope({ ...looping, outputEndSec: 7 }, { outputDurationSec: 20, sourceDurationSec: 2 }).endSec).toBe(7);
  });

  it('is silent outside its stretch', () => {
    const envelope = new AudioGainEnvelope(layer({ outputStartSec: 1, outputEndSec: 2 }), LONG);
    expect(envelope.gainAt(0.999)).toBe(0);
    expect(envelope.gainAt(2)).toBe(0);
    expect(new AudioGainEnvelope(layer({ outputStartSec: 3, outputEndSec: 2 }), LONG).breakpoints).toEqual([]);
  });

  it('plays the same curve when its breakpoints are scheduled as linear ramps', () => {
    const envelope = new AudioGainEnvelope(layer({
      outputStartSec: 1,
      outputEndSec: 9,
      gain: 0.7,
      fadeInSec: 1.5,
      fadeOutSec: 2,
      // The first range's attack overlaps the fade in, the last one's release the fade out.
      duck: { ranges: [{ startSec: 2, endSec: 3 }, { startSec: 7.5, endSec: 7.6 }], gain: 0.3, attackSec: 0.8, releaseSec: 0.6 },
    }), LONG);
    for (let timeSec = 1; timeSec < 9; timeSec += 0.0137) {
      expect(scheduledValueAt(envelope.breakpoints, timeSec)).toBeCloseTo(envelope.gainAt(timeSec), 12);
    }
  });

  it('samples the curve at frame times', () => {
    const envelope = new AudioGainEnvelope(layer({
      outputStartSec: 0.5,
      outputEndSec: 1.5,
      fadeInSec: 0.25,
      duck: { ranges: [{ startSec: 1, endSec: 1.2 }], gain: 0.5, attackSec: 0.1, releaseSec: 0.1 },
    }), LONG);
    const sampleRate = 1000;
    const gains = new Float32Array(1000);
    envelope.sampleInto(gains, 500, sampleRate);
    for (const [index, gain] of gains.entries()) {
      expect(gain).toBeCloseTo(envelope.gainAt((500 + index) / sampleRate), 6);
    }
  });
});

describe('the envelope of an input', () => {
  it('holds its gain over the whole output, lowered over the duck ranges', () => {
    const envelope = AudioGainEnvelope.forInput(0.8, [
      { ranges: [{ startSec: 2, endSec: 3 }], gain: 0, attackSec: 0.1, releaseSec: 0.1 },
      { ranges: [{ startSec: 5, endSec: 6 }], gain: 0.5, attackSec: 0.1, releaseSec: 0.1 },
    ], 10);
    expect(envelope.startSec).toBe(0);
    expect(envelope.endSec).toBe(10);
    expect(envelope.gainAt(1)).toBeCloseTo(0.8, 9);
    expect(envelope.gainAt(1.95)).toBeCloseTo(0.4, 9);
    expect(envelope.gainAt(2.5)).toBe(0);
    expect(envelope.gainAt(5.5)).toBeCloseTo(0.4, 9);
    expect(envelope.gainAt(9.9)).toBeCloseTo(0.8, 9);
  });

  it('runs open-ended while the output length is not known', () => {
    const envelope = AudioGainEnvelope.forInput(1, [], Number.POSITIVE_INFINITY);
    expect(envelope.endSec).toBe(Number.POSITIVE_INFINITY);
    expect(envelope.gainAt(1_000)).toBe(1);
  });
});
