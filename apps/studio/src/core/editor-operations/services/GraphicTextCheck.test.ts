import { describe, expect, it } from 'vitest';
import { GraphicTextCheck } from '@core/editor-operations/services/GraphicTextCheck';
import type { GraphicCheckFrame, GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';
import type { GraphicTextLayout } from '@core/graphics/domain/GraphicTextLayout';

const check = new GraphicTextCheck();
// A 1080 x 1920 frame: text under 28 px does not read on a phone.
const SHORT_SIDE = 1080;

function frame(sec: number, text: GraphicTextLayout | null): GraphicCheckFrame {
  return { sec, bitmap: null, drawnShare: 0.2, paintedShare: 0, error: null, text };
}

function report(durationSec: number, frames: GraphicCheckFrame[]): GraphicCheckReport {
  return { opened: true, openError: null, widthPx: 600, heightPx: 300, durationSec, frames, messages: [], moments: [] };
}

const READABLE: GraphicTextLayout = { smallest: { text: 'A WEEK', px: 40 }, cut: [] };

describe('the check of a graphic\'s text', () => {
  it('finds nothing wrong with text that reads and fits once landed', () => {
    expect(check.problemsOf(report(4, [frame(1.2, READABLE), frame(2.5, READABLE)]), SHORT_SIDE)).toEqual([]);
  });

  it('names text cut once landed, and leaves alone text moving in from outside its box or out of it', () => {
    const sliding: GraphicTextLayout = { smallest: { text: '$50', px: 200 }, cut: ['$50'] };
    const cut: GraphicTextLayout = { smallest: { text: 'A WEEK', px: 40 }, cut: ['never shop when you are hungry'] };

    const problems = check.problemsOf(report(4, [frame(0.1, sliding), frame(1.2, cut), frame(2.5, READABLE), frame(4, sliding)]), SHORT_SIDE);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"never shop when you are hungry"');
    expect(problems[0]).toContain('1.20 s');
    expect(problems[0]).not.toContain('"$50"');
  });

  it('names the smallest text once landed when it is under what reads on a phone', () => {
    const small: GraphicTextLayout = { smallest: { text: 'per week', px: 18 }, cut: [] };

    const problems = check.problemsOf(report(4, [frame(1.2, small), frame(2.5, READABLE)]), SHORT_SIDE);

    expect(problems).toEqual([expect.stringContaining('"per week", is 18 px, under the least that reads on a phone (28 px on this frame)')]);
  });

  it('judges a graphic too short to have landed by the frame nearest its middle', () => {
    const small: GraphicTextLayout = { smallest: { text: 'tip', px: 12 }, cut: [] };

    const problems = check.problemsOf(report(1.4, [frame(0.1, READABLE), frame(0.7, small), frame(1.4, READABLE)]), SHORT_SIDE);

    expect(problems).toEqual([expect.stringContaining('"tip", is 12 px')]);
  });

  it('says nothing of a graphic whose text could not be measured, as one drawn on a canvas', () => {
    expect(check.problemsOf(report(4, [frame(1.2, null), frame(2.5, null)]), SHORT_SIDE)).toEqual([]);
  });
});
