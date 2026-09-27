import { describe, expect, it } from 'vitest';
import { IsolatedWordLineSplitter } from '@modules/splitting/IsolatedWordLineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

type TimedWord = [text: string, start: number, end: number];

function segmentOf(words: TimedWord[]): Segment {
  const built = words.map(([text, start, end]) => new Word({ text, time: new TimeFragment(start, end) }));
  return new Segment({ lines: [new Line({ words: built })] });
}

const splitter = new IsolatedWordLineSplitter({
  minLetters: 4, minSecondsOnScreen: 0.8, fallbackMinSecondsOnScreen: 0.8, holdAfterLastWordSeconds: 0,
});

function split(words: TimedWord[]): string[] {
  return splitter.split([segmentOf(words)])[0]!.lines.map((line) => line.getText());
}

function splitHeld(words: TimedWord[], nextStartsAt: number): string[] {
  const held = new IsolatedWordLineSplitter({
    minLetters: 4, minSecondsOnScreen: 0.8, fallbackMinSecondsOnScreen: 0.8, holdAfterLastWordSeconds: 1,
  });
  const next = segmentOf([['next', nextStartsAt, nextStartsAt + 0.5]]);
  return held.split([segmentOf(words), next])[0]!.lines.map((line) => line.getText());
}

describe('IsolatedWordLineSplitter', () => {
  it('lifts the last word when it stays on screen long enough', () => {
    expect(split([['nobody', 0, 0.3], ['turning', 0.3, 1.2]])).toEqual(['nobody', 'turning']);
  });

  it('lifts an earlier word when the last one leaves the screen too soon', () => {
    expect(split([
      ['your', 0, 0.2], ['captions', 0.2, 0.9], ['are', 0.9, 1.1], ['the', 1.1, 1.2],
    ])).toEqual(['your', 'captions', 'are the']);
  });

  it('prefers the qualifying word closest to the end', () => {
    expect(split([
      ['your', 0, 0.2], ['captions', 0.2, 0.6], ['shape', 0.6, 0.9], ['every', 0.9, 1.1],
      ['single', 1.1, 2.0], ['frame', 2.0, 2.1],
    ])).toEqual(['your captions shape every', 'single', 'frame']);
  });

  it('never lifts a word too short to carry a line', () => {
    expect(split([['sound', 0, 0.2], ['on', 0.2, 2]])).toEqual(['sound on']);
  });

  it('keeps every word on one line when none qualifies', () => {
    expect(split([['your', 0, 0.1], ['captions', 0.1, 0.2], ['are', 0.2, 0.3]])).toEqual(['your captions are']);
  });

  it('never lifts the first word', () => {
    expect(split([['captions', 0, 2], ['go', 2, 2.1]])).toEqual(['captions go']);
  });

  it('counts the time the caption stays up after its last word', () => {
    expect(splitHeld([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.9]], 1.2))
      .toEqual(['i am at', 'legoland']);
  });

  it('stops counting when the next caption replaces it', () => {
    expect(splitHeld([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.9]], 0.9))
      .toEqual(['i am at legoland']);
  });

  it('ignores how long the word takes to say', () => {
    expect(splitHeld([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.4]], 1.2))
      .toEqual(['i am at', 'legoland']);
  });

  it('ignores how fast the word is said', () => {
    expect(splitHeld([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.4]], 1.2))
      .toEqual(['i am at', 'legoland']);
  });

  describe('with a looser fallback time', () => {
    const loose = new IsolatedWordLineSplitter({
      minLetters: 4, minSecondsOnScreen: 0.8, fallbackMinSecondsOnScreen: 0.6, holdAfterLastWordSeconds: 0,
    });

    function splitLoose(words: TimedWord[]): string[] {
      return loose.split([segmentOf(words)])[0]!.lines.map((line) => line.getText());
    }

    it('prefers a word reaching the stricter time over a later one reaching only the looser', () => {
      expect(splitLoose([
        ['your', 0, 0.2], ['captions', 0.2, 0.4], ['shape', 0.4, 0.7], ['every', 0.7, 1.0],
      ])).toEqual(['your', 'captions', 'shape every']);
    });

    it('falls back to the looser time when no word reaches the stricter one', () => {
      expect(splitLoose([['your', 0, 0.1], ['captions', 0.1, 0.4], ['matter', 0.4, 0.8]]))
        .toEqual(['your', 'captions', 'matter']);
    });
  });
});
