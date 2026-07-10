import type { Document, Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { DecorationVisibility } from '@core/captions/services/DecorationVisibility';

/**
 * Builds the variant of a segment or document the renderer should see:
 * every `Word.decoration` the visibility rule hides is replaced by
 * `null`. The source segment / document stays untouched — toggling the
 * emoji effect back on still recovers the original AI emojis the next
 * time the consumer asks for a filtered view.
 *
 * The host word identity is preserved on every clone (`Word.with`
 * keeps the id), so downstream lookups keyed by word or segment id
 * continue to resolve.
 */
export class DecorationFilter {
  constructor(private readonly visibility: DecorationVisibility) {}

  /** Returns a segment whose hidden decorations have been stripped, or the original segment when no decoration is hidden. */
  filterSegment(
    segment: Segment,
    sheet: Sheet,
    decorationOverrides: DecorationOverrideRegistry,
  ): Segment {
    const emojiEnabled = sheet.effectConfig('emoji')?.enabled ?? false;
    return this.cloneSegmentWithoutHiddenDecorations(segment, emojiEnabled, decorationOverrides);
  }

  /** Returns a document whose hidden decorations have been stripped across every section, picking the host sheet per section. */
  filterDocument(
    document: Document,
    sheets: ReadonlyArray<Sheet>,
    decorationOverrides: DecorationOverrideRegistry,
  ): Document {
    const sheetsById = new Map<string, Sheet>(sheets.map((s) => [s.id, s]));
    return document.with({
      sections: document.sections.map((section) => {
        const sheet = sheetsById.get(section.kind);
        if (!sheet) return section;
        const emojiEnabled = sheet.effectConfig('emoji')?.enabled ?? false;
        return section.with({
          segments: section.segments.map((segment) =>
            this.cloneSegmentWithoutHiddenDecorations(segment, emojiEnabled, decorationOverrides),
          ),
        });
      }),
    });
  }

  private cloneSegmentWithoutHiddenDecorations(
    segment: Segment,
    emojiEnabled: boolean,
    decorationOverrides: DecorationOverrideRegistry,
  ): Segment {
    return segment.with({
      lines: segment.lines.map((line) =>
        line.with({ words: line.words.map((word) => this.maybeHideWordDecoration(word, emojiEnabled, decorationOverrides)) }),
      ),
    });
  }

  private maybeHideWordDecoration(
    word: Word,
    emojiEnabled: boolean,
    decorationOverrides: DecorationOverrideRegistry,
  ): Word {
    const decoration = word.decoration;
    if (!decoration) return word;
    const override = decorationOverrides.get(decoration.id);
    if (this.visibility.isVisible(override, emojiEnabled)) return word;
    return word.with({ decoration: null });
  }
}
