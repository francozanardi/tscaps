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
 * A caption shows at most one of the decorations transcription picked:
 * the last it holds, in reading order, which sits nearest the end of
 * the clause, where its punch usually lands. Deleting that one leaves
 * the caption without one rather than bringing an earlier one back,
 * and the ones the user added or edited show beside it.
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

  /**
   * Whether any word keeps a decoration once the visibility rule is
   * applied, asked without building the filtered copy. A section with no
   * sheet counts, matching what {@link filterDocument} leaves untouched.
   */
  hasVisibleDecoration(
    document: Document,
    sheets: ReadonlyArray<Sheet>,
    decorationOverrides: DecorationOverrideRegistry,
  ): boolean {
    const sheetsById = new Map<string, Sheet>(sheets.map((s) => [s.id, s]));
    for (const section of document.sections) {
      const sheet = sheetsById.get(section.kind);
      const emojiEnabled = sheet?.effectConfig('emoji')?.enabled ?? false;
      for (const segment of section.segments) {
        const pickId = this.captionPickId(segment, decorationOverrides);
        for (const word of segment.getWords()) {
          const decoration = word.decoration;
          if (!decoration) continue;
          if (!sheet) return true;
          if (this.visibility.isVisible(decorationOverrides.get(decoration.id), emojiEnabled, decoration.id === pickId)) return true;
        }
      }
    }
    return false;
  }

  private cloneSegmentWithoutHiddenDecorations(
    segment: Segment,
    emojiEnabled: boolean,
    decorationOverrides: DecorationOverrideRegistry,
  ): Segment {
    const pickId = this.captionPickId(segment, decorationOverrides);
    return segment.with({
      lines: segment.lines.map((line) =>
        line.with({ words: line.words.map((word) => this.maybeHideWordDecoration(word, emojiEnabled, decorationOverrides, pickId)) }),
      ),
    });
  }

  private maybeHideWordDecoration(
    word: Word,
    emojiEnabled: boolean,
    decorationOverrides: DecorationOverrideRegistry,
    pickId: string | null,
  ): Word {
    const decoration = word.decoration;
    if (!decoration) return word;
    const override = decorationOverrides.get(decoration.id);
    if (this.visibility.isVisible(override, emojiEnabled, decoration.id === pickId)) return word;
    return word.with({ decoration: null });
  }

  /**
   * The one decoration of transcription's the caption may show: the last
   * in reading order, deleted or not, so deleting it does not hand the
   * place to the one before. `null` when transcription picked none.
   */
  private captionPickId(segment: Segment, decorationOverrides: DecorationOverrideRegistry): string | null {
    let pickId: string | null = null;
    for (const word of segment.getWords()) {
      const decoration = word.decoration;
      if (!decoration) continue;
      if (this.visibility.isChosenByUser(decorationOverrides.get(decoration.id))) continue;
      pickId = decoration.id;
    }
    return pickId;
  }
}
