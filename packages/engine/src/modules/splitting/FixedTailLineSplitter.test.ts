import { describe, expect, it } from 'vitest';
import { FixedTailLineSplitter } from '@modules/splitting/FixedTailLineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

function segmentOf(text: string): Segment {
  const words = text.split(' ').map((word, i) => new Word({ text: word, time: new TimeFragment(i, i + 1) }));
  return new Segment({ lines: [new Line({ words })] });
}

function split(text: string, tailWordCount: number, minWordsToSplit?: number): string[] {
  const splitter = new FixedTailLineSplitter({ tailWordCount, minWordsToSplit });
  return splitter.split([segmentOf(text)])[0]!.lines.map((line) => line.getText());
}

describe('FixedTailLineSplitter', () => {
  it('moves the last words onto a line of their own', () => {
    expect(split('the sound is on', 1)).toEqual(['the sound is', 'on']);
  });

  it('keeps a two-word segment on one line by default', () => {
    expect(split('nobody turning', 1)).toEqual(['nobody turning']);
  });

  it('splits a two-word segment when the minimum allows it', () => {
    expect(split('nobody turning', 1, 2)).toEqual(['nobody', 'turning']);
  });

  it('never splits a single word, whatever the minimum', () => {
    expect(split('turning', 1, 1)).toEqual(['turning']);
  });
});
