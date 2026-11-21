import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { ResolvedShot } from '@core/shots/domain/ResolvedShot';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotResolver } from '@core/shots/services/ShotResolver';

/**
 * What a shot turns out to hold, read against the document of the
 * moment. The partition stores openings and nothing else, so the
 * extent and the words are answered here every time.
 */

const resolver = new ShotResolver();

const textOf = (shot: ResolvedShot): string => shot.pieces.map((piece) => piece.text).join(' ');
const VIDEO_END = 10;

function documentOf(words: ReadonlyArray<[string, number, number]>): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: [new Segment({
        lines: [new Line({ words: words.map(([text, start, end]) => new Word({ text, time: new TimeFragment(start, end) })) })],
      })],
    })],
  });
}

const SPEECH = documentOf([['one', 0, 1], ['two', 1, 2], ['three', 4, 5], ['four', 8, 9]]);

describe('ShotResolver', () => {
  it('ends each shot where the next one opens, and the last one with the video', () => {
    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 4, 8]), SPEECH, VIDEO_END);

    expect(shots.map((shot) => [shot.startSec, shot.endSec])).toEqual([[0, 4], [4, 8], [8, VIDEO_END]]);
  });

  it('gives each shot the words spoken inside it, in the order they are spoken', () => {
    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 4]), SPEECH, VIDEO_END);

    expect(shots.map(textOf)).toEqual(['one two', 'three four']);
  });

  it('marks a word it cuts through on both sides of the cut', () => {
    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 3]), documentOf([['example', 2, 4]]), VIDEO_END);

    expect(shots.map(textOf)).toEqual(['exam…', '…ple']);
  });

  it('gives a word whole to one side rather than showing a piece with no letters in it', () => {
    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 2.01]), documentOf([['example', 2, 4]]), VIDEO_END);

    expect(shots.map(textOf)).toEqual(['', 'example']);
  });

  it('has nothing to resolve without a partition', () => {
    expect(resolver.resolve(ShotPartition.empty(), SPEECH, VIDEO_END)).toEqual([]);
  });

  it('resolves a shot holding no words at all', () => {
    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 2]), documentOf([['one', 0, 1]]), VIDEO_END);

    expect(textOf(shots[1]!)).toBe('');
  });
  it('keeps a word with no duration in the shot that opens on it', () => {
    const document = documentOf([['like', 1, 2], ['Oh,', 3, 3], ['cool.', 4, 5]]);

    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 3]), document, VIDEO_END);

    expect(shots.map(textOf)).toEqual(['like', 'Oh, cool.']);
  });

  it('keeps a word with no duration in the shot it falls inside', () => {
    const document = documentOf([['like', 1, 2], ['Oh,', 3, 3]]);

    const shots = resolver.resolve(ShotPartition.empty().withProposal([0, 5]), document, VIDEO_END);

    expect(shots.map(textOf)).toEqual(['like Oh,', '']);
  });
});
