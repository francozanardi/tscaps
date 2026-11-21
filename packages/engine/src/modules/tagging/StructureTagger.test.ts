import { describe, expect, it } from 'vitest';
import { StructureTagger } from '@modules/tagging';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import { StructureTag } from '@modules/tags/StructureTag';
import { Tag } from '@modules/tags/Tag';

function documentOf(line: Line): Document {
  return new Document({ sections: [new Section({ segments: [new Segment({ lines: [line] })], kind: 'main' })] });
}

function firstLineOf(document: Document): Line {
  return document.sections[0]!.segments[0]!.lines[0]!;
}

function lineOf(text: string, props: { id?: string } = {}): Line {
  const words = text.split(' ').map((word, i) => new Word({ text: word, time: new TimeFragment(i, i + 1) }));
  return new Line({ words, ...props });
}

describe('StructureTagger', () => {

  it('says when a segment opens or closes with its isolated line, and only then', () => {
    const isolated = new Line({ words: [new Word({ text: 'nobody', time: new TimeFragment(0, 1) })], structureTags: new Set([Tag.of(StructureTag.ISOLATED_LINE)]) });
    const rest = lineOf('talks about it');
    const tagsOf = (lines: Line[]): string[] => {
      const document = new Document({ sections: [new Section({ segments: [new Segment({ lines })], kind: 'main' })] });
      return [...new StructureTagger().tag(document).sections[0]!.segments[0]!.structureTags].map((tag) => tag.name);
    };
    expect(tagsOf([isolated, rest])).toContain(StructureTag.OPENS_WITH_ISOLATED_LINE);
    expect(tagsOf([isolated, rest])).not.toContain(StructureTag.CLOSES_WITH_ISOLATED_LINE);
    expect(tagsOf([rest, isolated])).not.toContain(StructureTag.OPENS_WITH_ISOLATED_LINE);
    expect(tagsOf([rest, isolated])).toContain(StructureTag.CLOSES_WITH_ISOLATED_LINE);
    expect(tagsOf([rest])).not.toContain(StructureTag.CLOSES_WITH_ISOLATED_LINE);
  });

  it('tags the ends of a line', () => {
    const tagged = firstLineOf(new StructureTagger().tag(documentOf(lineOf('no one told me'))));
    expect(tagged.words[0]!.hasTagName(StructureTag.FIRST_WORD_IN_LINE)).toBe(true);
    expect(tagged.words[3]!.hasTagName(StructureTag.LAST_WORD_IN_LINE)).toBe(true);
  });

  // Tagging rebuilds every line it touches. Anything the line was already
  // carrying that tagging has no opinion about has to survive that rebuild,
  // or whoever put it there sees it silently dropped one step later.
  it('keeps what the line already carried', () => {
    const line = lineOf('no one told me', { id: 'line-1' });
    const tagged = firstLineOf(new StructureTagger().tag(documentOf(line)));
    expect(tagged.id).toBe('line-1');
  });

  it('keeps a line marked isolated while it holds a single word', () => {
    const line = new Line({
      words: [new Word({ text: 'captions', time: new TimeFragment(0, 1) })],
      structureTags: new Set([Tag.of(StructureTag.ISOLATED_LINE)]),
    });
    const tagged = firstLineOf(new StructureTagger().tag(documentOf(line)));
    expect([...tagged.structureTags].map((tag) => tag.name)).toContain(StructureTag.ISOLATED_LINE);
  });

  it('drops the isolated mark once the line holds more than one word', () => {
    const line = new Line({
      words: lineOf('captions matter').words,
      structureTags: new Set([Tag.of(StructureTag.ISOLATED_LINE)]),
    });
    const tagged = firstLineOf(new StructureTagger().tag(documentOf(line)));
    expect([...tagged.structureTags].map((tag) => tag.name)).not.toContain(StructureTag.ISOLATED_LINE);
  });
});
