import { Tag, type Document, type Line, type Section, type Segment, type Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TEMPLATE_TAG_NAMES, type TemplateTagName } from '@core/tagging/domain/TagName';
import type { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';

/**
 * Sets the template tags of a sheet's words: the tag of each mode its
 * template designs, on the words that mode's matchers pick. Every
 * template tag a word carried before is taken off first, the person's
 * own included, since it was set for another template or for words that
 * have since changed. A word two modes pick goes to the first.
 */
export class CaptionModeAssigner {
  private static readonly TEMPLATE_TAG_SET: ReadonlySet<string> = new Set(TEMPLATE_TAG_NAMES);

  constructor(private readonly matchers: ModeMatcherRegistry) {}

  /**
   * `document` with the template tags of every section routed to one of
   * `sheetIds` (every sheet when absent) set afresh by its sheet's
   * template. Sections of other sheets come back as they were.
   */
  assign(document: Document, sheets: ReadonlyArray<Sheet>, sheetIds?: ReadonlySet<string>): Document {
    const sections = document.sections.map((section) => {
      const sheet = sheets.find((candidate) => candidate.id === section.kind);
      if (!sheet || (sheetIds && !sheetIds.has(sheet.id))) return section;
      return this.assignSection(section, this.modeTagsOf(section, sheet));
    });
    return document.with({ sections });
  }

  private modeTagsOf(section: Section, sheet: Sheet): ReadonlyMap<string, TemplateTagName> {
    const words = section.segments.flatMap((segment) => segment.getWords());
    const tags = new Map<string, TemplateTagName>();
    for (const mode of sheet.template.modes.extra) {
      for (const config of mode.matchers) {
        for (const wordId of this.matchers.build(config).matchingWordIds(words)) {
          if (!tags.has(wordId)) tags.set(wordId, mode.tag);
        }
      }
    }
    return tags;
  }

  private assignSection(section: Section, modeTags: ReadonlyMap<string, TemplateTagName>): Section {
    return section.with({ segments: section.segments.map((segment) => this.assignSegment(segment, modeTags)) });
  }

  private assignSegment(segment: Segment, modeTags: ReadonlyMap<string, TemplateTagName>): Segment {
    return segment.with({ lines: segment.lines.map((line) => this.assignLine(line, modeTags)) });
  }

  private assignLine(line: Line, modeTags: ReadonlyMap<string, TemplateTagName>): Line {
    return line.with({ words: line.words.map((word) => this.assignWord(word, modeTags.get(word.id))) });
  }

  private assignWord(word: Word, modeTag: TemplateTagName | undefined): Word {
    const kept = [...word.semanticTags].filter((tag) => !CaptionModeAssigner.TEMPLATE_TAG_SET.has(tag.name));
    if (modeTag === undefined && kept.length === word.semanticTags.size) return word;
    return word.with({ semanticTags: new Set(modeTag ? [...kept, Tag.of(modeTag)] : kept) });
  }
}
