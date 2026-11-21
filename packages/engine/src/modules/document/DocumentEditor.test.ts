import { describe, expect, it } from 'vitest';
import { Decoration } from '@modules/document/Decoration';
import { Document } from '@modules/document/Document';
import { DocumentEditor } from '@modules/document/DocumentEditor';
import { Line } from '@modules/document/Line';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';

const WINDOW = new TimeFragment(0.5, 4.5);

/** One scene of four words, shown over a window a caller set on it. */
function sceneWithWindow(): Document {
  const words = ['no', 'one', 'told', 'me'].map((text, index) => new Word({ text, time: new TimeFragment(index + 1, index + 1.8) }));
  return new Document({ sections: [new Section({ segments: [new Segment({ lines: [new Line({ words })], customTime: WINDOW })], kind: 'main' })] });
}

function windowOf(doc: Document): TimeFragment | null {
  return doc.getSegments()[0]!.customTime;
}

describe('DocumentEditor keeps a window set on a scene', () => {
  const editor = new DocumentEditor();

  it('through a word\'s text changed, into one word or several', () => {
    const doc = sceneWithWindow();
    const word = doc.getSegments()[0]!.lines[0]!.words[2]!;

    const retyped = editor.replaceWordAt(doc, 0, 0, 2, editor.computeWordTextSplit(word, 'said'));
    const split = editor.replaceWordAt(doc, 0, 0, 2, editor.computeWordTextSplit(word, 'ever told'));

    expect(windowOf(retyped)).toEqual(WINDOW);
    expect(windowOf(split)).toEqual(WINDOW);
  });

  it('through an emoji put on a word or taken off it', () => {
    const decorated = editor.setWordDecoration(sceneWithWindow(), 0, 0, 1, new Decoration({ id: 'shh', glyph: '🤫' }));
    const cleared = editor.clearWordDecoration(decorated, 0, 0, 1);

    expect(windowOf(decorated)).toEqual(WINDOW);
    expect(windowOf(cleared)).toEqual(WINDOW);
  });

  it('through a word\'s time moved', () => {
    expect(windowOf(editor.updateWordTime(sceneWithWindow(), 0, 0, 0, 1.1, 1.7))).toEqual(WINDOW);
  });

  it('but not through a word deleted, which changes what the scene holds', () => {
    expect(windowOf(editor.deleteWord(sceneWithWindow(), 0, 0, 3))).toBeNull();
  });
});
