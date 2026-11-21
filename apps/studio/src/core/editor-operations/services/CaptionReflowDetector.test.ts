import { describe, expect, it } from 'vitest';
import { Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';

/**
 * A re-split retires the scene refs a caller may still hold, and where
 * the captions carry emojis, it may change which of them show.
 */

const detector = new CaptionReflowDetector();

function captions(groups: ReadonlyArray<ReadonlyArray<string>>, emojiOn: string | null = null): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: groups.map((ids) => new Segment({
        id: ids.join('-'),
        lines: [new Line({ words: ids.map((id, index) => new Word({
          id,
          text: id,
          time: new TimeFragment(index, index + 1),
          decoration: id === emojiOn ? new Decoration({ id: `${id}:d`, glyph: '🔥' }) : null,
        })) })],
      })),
    })],
  });
}

describe('a re-split', () => {
  it('says the suggested emojis may have changed, where the captions carry any', () => {
    const warning = detector.warningFor(captions([['a', 'b'], ['c']], 'b'), captions([['a'], ['b', 'c']], 'b'));

    expect(warning?.message).toBe('The captions were re-split, retiring 2 scene ref(s) read before this call; line refs changed too, and the suggested emojis may have changed with the layout, by design. Word refs still hold: read the transcript again before using segment or line refs.');
  });

  it('says nothing of emojis where the captions carry none', () => {
    const warning = detector.warningFor(captions([['a', 'b'], ['c']]), captions([['a'], ['b', 'c']]));

    expect(warning?.message).not.toContain('emoji');
  });

  it('says nothing where every scene kept its ref', () => {
    expect(detector.warningFor(captions([['a', 'b']], 'b'), captions([['a', 'b']], 'b'))).toBeNull();
  });
});
