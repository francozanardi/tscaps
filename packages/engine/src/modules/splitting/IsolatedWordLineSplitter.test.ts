import { describe, expect, it } from 'vitest';
import { IsolatedWordLineSplitter } from '@modules/splitting/IsolatedWordLineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Tag } from '@modules/tags/Tag';
import { TagConditionParser } from '@modules/tags/TagConditionParser';

type TimedWord = [text: string, start: number, end: number];

function segmentOf(words: TimedWord[], shownUntil?: number): Segment {
  const built = words.map(([text, start, end]) => new Word({ text, time: new TimeFragment(start, end) }));
  const segment = new Segment({ lines: [new Line({ words: built })] });
  if (shownUntil === undefined) return segment;
  return segment.with({ effectTime: new TimeFragment(segment.wordTime.start, shownUntil) });
}

const splitter = new IsolatedWordLineSplitter({
  minLetters: 4, minSecondsOnScreen: 0.8, fallbackMinSecondsOnScreen: 0.8,
});

function split(words: TimedWord[]): string[] {
  return splitter.split([segmentOf(words)])[0]!.lines.map((line) => line.getText());
}

function splitShownUntil(words: TimedWord[], shownUntil: number): string[] {
  return splitter.split([segmentOf(words, shownUntil)])[0]!.lines.map((line) => line.getText());
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

  it('counts the time the segment is shown for past its last word', () => {
    expect(splitShownUntil([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.9]], 1.2))
      .toEqual(['i am at', 'legoland']);
  });

  it('stops counting where the segment stops being shown', () => {
    expect(splitShownUntil([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.9]], 0.9))
      .toEqual(['i am at legoland']);
  });

  it('ignores how long the word takes to say', () => {
    expect(splitShownUntil([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.4]], 1.2))
      .toEqual(['i am at', 'legoland']);
  });

  describe('with a looser fallback time', () => {
    const loose = new IsolatedWordLineSplitter({
      minLetters: 4, minSecondsOnScreen: 0.8, fallbackMinSecondsOnScreen: 0.6,
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

  describe('with a tag priority', () => {
    type TaggedWord = [text: string, start: number, end: number, tags?: string[]];

    const parser = new TagConditionParser();
    const prioritizing = new IsolatedWordLineSplitter({
      minLetters: 4,
      minSecondsOnScreen: 0.8,
      fallbackMinSecondsOnScreen: 0.6,
      tagPriority: [parser.parse('alpha'), parser.parse('beta')],
    });

    function splitTagged(words: TaggedWord[]): string[] {
      const built = words.map(([text, start, end, tags]) => new Word({
        text,
        time: new TimeFragment(start, end),
        semanticTags: new Set((tags ?? []).map((name) => Tag.of(name))),
      }));
      const segment = new Segment({ lines: [new Line({ words: built })] });
      return prioritizing.split([segment])[0]!.lines.map((line) => line.getText());
    }

    it('lifts the tagged word over a later word the length rule would take', () => {
      expect(splitTagged([
        ['and', 0, 0.2], ['every', 0.2, 0.4], ['story', 0.4, 0.8, ['alpha']], ['becomes', 0.8, 1.0],
        ['different', 1.0, 2.0],
      ])).toEqual(['and every', 'story', 'becomes different']);
    });

    it('lifts a tagged word too short for the length rule', () => {
      expect(splitTagged([['has', 0, 0.2], ['humbled', 0.2, 0.6], ['me', 0.6, 1.6, ['alpha']]]))
        .toEqual(['has humbled', 'me']);
    });

    it('takes a tagged word on the looser time before an untagged one on the stricter', () => {
      expect(splitTagged([
        ['how', 0, 0.1], ['always', 0.1, 0.3], ['grateful', 0.4, 0.5, ['alpha']], ['really', 0.5, 1.1],
      ])).toEqual(['how always', 'grateful', 'really']);
    });

    it('falls back to the length rule when no tagged word stays on screen long enough', () => {
      expect(splitTagged([['for', 0, 0.2], ['the', 0.2, 0.3], ['people', 0.3, 1.4], ['here', 1.4, 1.5, ['alpha']]]))
        .toEqual(['for the', 'people', 'here']);
    });

    it('lifts a word matching an earlier condition over a later word matching a later one', () => {
      expect(splitTagged([
        ['the', 0, 0.2], ['biggest', 0.2, 0.5, ['alpha']], ['decisions', 0.5, 0.9, ['beta']], ['of', 0.9, 1.6],
      ])).toEqual(['the', 'biggest', 'decisions of']);
    });

    it('turns to a later condition when no word matches an earlier one', () => {
      expect(splitTagged([
        ['for', 0, 0.2], ['the', 0.2, 0.3], ['people', 0.3, 0.6, ['beta']], ['around', 0.6, 1.6],
      ])).toEqual(['for the', 'people', 'around']);
    });

    it('never lifts a tagged first word', () => {
      expect(splitTagged([['quarterly', 0, 0.5, ['alpha']], ['recaps', 0.5, 1.6]]))
        .toEqual(['quarterly', 'recaps']);
    });
  });

  describe('searching from the start', () => {
    const fromStart = new IsolatedWordLineSplitter({
      minLetters: 5, minSecondsOnScreen: 0.8, searchFrom: 'start',
    });

    function splitFromStart(words: TimedWord[]): string[] {
      return fromStart.split([segmentOf(words)])[0]!.lines.map((line) => line.getText());
    }

    it('lifts the qualifying word closest to the start', () => {
      expect(splitFromStart([
        ['and', 0, 0.1], ['i', 0.1, 0.2], ['truly', 0.2, 0.5], ['cannot', 0.5, 0.8], ['express', 0.8, 1.7],
      ])).toEqual(['and i', 'truly', 'cannot express']);
    });

    it('still never lifts the first word', () => {
      expect(splitFromStart([['quarterly', 0, 0.5], ['recaps', 0.5, 1.6]])).toEqual(['quarterly', 'recaps']);
    });

    it('passes over an early word too short to carry a line', () => {
      expect(splitFromStart([['go', 0, 0.1], ['to', 0.1, 0.2], ['really', 0.2, 0.3], ['quickly', 0.3, 1.2]]))
        .toEqual(['go to', 'really', 'quickly']);
    });
  });
});
