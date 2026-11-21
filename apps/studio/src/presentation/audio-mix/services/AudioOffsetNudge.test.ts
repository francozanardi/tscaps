import { describe, expect, it } from 'vitest';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { AudioOffsetNudge } from '@presentation/audio-mix/services/AudioOffsetNudge';

const nudge = new AudioOffsetNudge();
const WORD: AudioAnchor = { kind: 'word', wordId: 'w', edge: 'start' };
const VIDEO: AudioAnchor = { kind: 'video', edge: 'start' };

describe('AudioOffsetNudge', () => {
  it('moves by twentieths of a second, rounded to the step', () => {
    expect(nudge.nudged({ anchor: WORD, offsetSec: 0.12 }, 1)).toBe(0.15);
    expect(nudge.nudged({ anchor: WORD, offsetSec: 0 }, -2)).toBe(-0.1);
  });

  it('keeps an effect on the edit within a second of its anchor', () => {
    expect(nudge.nudged({ anchor: WORD, offsetSec: 1 }, 1)).toBe(1);
    expect(nudge.canNudge({ anchor: WORD, offsetSec: -1 }, -1)).toBe(false);
  });

  it('moves one already further out back toward its anchor, never further away', () => {
    expect(nudge.nudged({ anchor: WORD, offsetSec: 1.4 }, -1)).toBe(1.35);
    expect(nudge.canNudge({ anchor: WORD, offsetSec: 1.4 }, 1)).toBe(false);
  });

  it('lets an effect on the video\'s start move far along it', () => {
    expect(nudge.nudged({ anchor: VIDEO, offsetSec: 12.3 }, 1)).toBe(12.35);
  });

  it('says how far it is, signed', () => {
    expect(nudge.labelOf(0)).toBe('0.00s');
    expect(nudge.labelOf(0.1)).toBe('+0.10s');
    expect(nudge.labelOf(-0.05)).toBe('−0.05s');
  });
});
