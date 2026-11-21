import { describe, expect, it } from 'vitest';
import {
  BoundaryScorePauseCutScorer,
  GreedyLimitByCharsSegmentSplitter,
  OptimalLimitByCharsSegmentSplitter,
  TagBonusCutScorer,
} from '@modules/splitting';
import { TagConditionParser, Tag } from '@modules/tags';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

/** Words of `text`, said back to back; a word written `word#tag` carries that semantic tag. */
function segmentOf(text: string): Segment {
  const words = text.split(' ').map((token, index) => {
    const [word, tag] = token.split('#');
    return new Word({
      text: word!,
      time: new TimeFragment(index * 0.3, index * 0.3 + 0.3),
      semanticTags: tag ? new Set([Tag.of(tag)]) : undefined,
    });
  });
  return new Segment({ lines: [new Line({ words })] });
}

function split(text: string, scorerFor: (inner: BoundaryScorePauseCutScorer) => BoundaryScorePauseCutScorer | TagBonusCutScorer): string[] {
  const bounds = { maxChars: 40, minChars: 14 };
  const scorer = scorerFor(new BoundaryScorePauseCutScorer(null));
  const splitter = new OptimalLimitByCharsSegmentSplitter(
    { ...bounds, cutCost: 0.4 },
    scorer,
    new GreedyLimitByCharsSegmentSplitter(bounds, scorer),
  );
  return splitter.split([segmentOf(text)]).map((segment) => segment.getText());
}

const HOOK = 'The first three seconds decide#emphasis whether anyone watches the rest of this';

describe('TagBonusCutScorer', () => {
  it('breaks a run right after a word carrying the tag, where the bounds leave the choice', () => {
    const withBonus = split(HOOK, (inner) => new TagBonusCutScorer(inner, new TagConditionParser().parse('emphasis'), 1));
    expect(withBonus).toEqual(['The first three seconds decide', 'whether anyone watches the rest of this']);
    expect(split(HOOK, (inner) => inner)).not.toEqual(withBonus);
  });

  it('leaves the cut to the bounds where no word carries the tag', () => {
    const plain = split(HOOK.replace('#emphasis', ''), (inner) => new TagBonusCutScorer(inner, new TagConditionParser().parse('emphasis'), 1));
    const without = split(HOOK.replace('#emphasis', ''), (inner) => inner);
    expect(plain).toEqual(without);
  });
});
