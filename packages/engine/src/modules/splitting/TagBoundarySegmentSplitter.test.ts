import { describe, expect, it } from 'vitest';
import {
  BalancedLineSplitter,
  LimitByWordsSegmentSplitter,
  TagBoundarySegmentSplitter,
  TagRoutedLineSplitter,
  TagRoutedSegmentSplitter,
} from '@modules/splitting';
import { Tag, TagConditionParser } from '@modules/tags';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

const parser = new TagConditionParser();

/** `text` read word by word; a word written `word:tag` carries that tag. */
function runOf(text: string): Segment {
  const words = text.split(' ').map((token, i) => {
    const [wordText, tagName] = token.split(':');
    const semanticTags = tagName ? new Set([Tag.of(tagName)]) : new Set<Tag>();
    return new Word({ text: wordText!, time: new TimeFragment(i, i + 1), semanticTags });
  });
  return new Segment({ lines: [new Line({ words })] });
}

function textsOf(segments: ReadonlyArray<Segment>): string[] {
  return segments.map((segment) => segment.getText());
}

function linesOf(segments: ReadonlyArray<Segment>): string[][] {
  return segments.map((segment) => segment.lines.map((line) => line.words.map((word) => word.text).join(' ')));
}

describe('TagBoundarySegmentSplitter', () => {
  const splitter = new TagBoundarySegmentSplitter(parser.parse('spotlight'));

  it('gives a run of matching words a segment of its own', () => {
    const segments = splitter.split([runOf('so this is it:spotlight what:spotlight matters:spotlight and then more')]);

    expect(textsOf(segments)).toEqual(['so this is', 'it what matters', 'and then more']);
  });

  it('leaves a segment whose words all match, or none do, as it was', () => {
    const plain = runOf('nothing to see here');
    const matching = runOf('a:spotlight b:spotlight');

    expect(splitter.split([plain, matching])).toEqual([plain, matching]);
  });
});

describe('TagRoutedSegmentSplitter', () => {
  it('cuts each segment the way its route says, and the rest by the fallback, in order', () => {
    const splitter = new TagRoutedSegmentSplitter(
      [{ condition: parser.parse('spotlight'), splitter: new LimitByWordsSegmentSplitter({ maxWords: 3 }) }],
      new LimitByWordsSegmentSplitter({ maxWords: 1 }),
    );

    const segments = splitter.split([runOf('one two'), runOf('a:spotlight b:spotlight c:spotlight d:spotlight'), runOf('three')]);

    expect(textsOf(segments)).toEqual(['one', 'two', 'a b c', 'd', 'three']);
  });
});

describe('TagRoutedLineSplitter', () => {
  it('lays out each segment with the splitter of its route', () => {
    const splitter = new TagRoutedLineSplitter(
      [{ condition: parser.parse('spotlight'), splitter: new BalancedLineSplitter({ maxLines: 3, minLines: 1, maxCharsPerLine: 3 }) }],
      new BalancedLineSplitter({ maxLines: 1, minLines: 1, maxCharsPerLine: 100 }),
    );

    const segments = splitter.split([runOf('one two three'), runOf('aa:spotlight bb:spotlight cc:spotlight')]);

    expect(linesOf(segments)).toEqual([['one two three'], ['aa', 'bb', 'cc']]);
  });
});
