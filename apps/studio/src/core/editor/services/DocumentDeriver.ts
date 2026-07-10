import type { Tagger, Word } from '@tscaps/engine';
import { Document, Line, Section, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import type { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import type { EffectRegistry } from '@core/effect/services/EffectRegistry';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import type { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';

export interface DerivationGeometry {
  videoWidth: number;
  videoHeight: number;
}

export interface DocumentDeriverContext extends DerivationGeometry {
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  videoDurationSeconds: number;
}

/**
 * Re-pipes each Section of a Document according to its `Section.kind`
 * (which is a Sheet id). Within each section, contiguous runs of
 * unfrozen segments are merged into a single word stream and re-run
 * through the sheet's pipeline (segment splitters in declared order →
 * LineSplitter); frozen segments are kept verbatim between those runs.
 * Splitters never see across a frozen segment, so a frozen scene acts
 * as an immovable barrier the way the user shaped it. After piping,
 * the supplied taggers run in order to refresh positional and temporal
 * tags.
 *
 * Semantic tags (regex/wordlist/AI) are not re-applied here: they live
 * on `Word.semanticTags` as persisted document state, written once by
 * the preprocessing pipeline and edited manually thereafter.
 */
export class DocumentDeriver {
  constructor(
    private readonly taggers: ReadonlyArray<Tagger>,
    private readonly segmentSplitters: SegmentSplitterRegistry,
    private readonly lineSplitters: LineSplitterRegistry,
    private readonly effects: EffectRegistry,
    private readonly sheetCssVarsBuilder: SheetCssVarsBuilder,
    private readonly decorationTimeResolver: DecorationTimeResolver,
    private readonly inlineEmojiPunctuationAbsorber: InlineEmojiPunctuationAbsorber,
  ) {}

  derive(
    document: Document,
    sheets: ReadonlyArray<Sheet>,
    ctx: DocumentDeriverContext,
  ): Document {
    const sheetById = new Map(sheets.map((s) => [s.id, s]));

    const sections: Section[] = [];
    for (const section of document.sections) {
      const sheet = sheetById.get(section.kind);
      if (!sheet) continue;
      const piped = this.reflowSection(section.segments, sheet, ctx);
      if (piped.length === 0) continue;
      sections.push(section.with({ segments: piped }));
    }

    const tagged = this.runTaggers(new Document({ sections }));
    const withEffects = this.applyEffects(tagged, sheets, ctx.videoDurationSeconds);
    const withOverrides = this.applyDecorationOverrides(withEffects, sheetById, ctx.decorationOverrides);
    return this.inlineEmojiPunctuationAbsorber.absorb(withOverrides, sheetById);
  }

  /**
   * Re-runs the configured taggers on an already-structured Document.
   * Section identity (id + kind) is taken from the input; the splitter
   * pipeline is not re-run.
   */
  retag(document: Document): Document {
    return this.runTaggers(document);
  }

  private runTaggers(document: Document): Document {
    return this.taggers.reduce((doc, tagger) => tagger.tag(doc), document);
  }

  /**
   * Re-runs every enabled Effect of every sheet over `document` without
   * touching the splitter pipeline or the structure tagger. Cheap path
   * for edits that change segment content but not its splitter inputs
   * (text, tags, line breaks, cross-segment word moves) and that still
   * need Effects like gap-free to re-stamp time padding against the
   * fresh word boundaries.
   */
  reapplyEffects(
    document: Document,
    sheets: ReadonlyArray<Sheet>,
    videoDurationSeconds: number,
    decorationOverrides: DecorationOverrideRegistry,
  ): Document {
    const sheetById = new Map(sheets.map((s) => [s.id, s]));
    const withEffects = this.applyEffects(document, sheets, videoDurationSeconds);
    const withOverrides = this.applyDecorationOverrides(withEffects, sheetById, decorationOverrides);
    return this.inlineEmojiPunctuationAbsorber.absorb(withOverrides, sheetById);
  }

  /**
   * Runs the splitter pipeline of a single Sheet over the given segments,
   * unconditionally — freeze state is ignored. Used to re-pipe an
   * arbitrary slice of a Document under a target sheet's rules when the
   * caller has already decided no freeze should apply (e.g. piping a
   * single segment being moved into a new sheet).
   */
  runSheetPipeline(
    segments: ReadonlyArray<Segment>,
    sheet: Sheet,
    geometry: DerivationGeometry,
  ): Segment[] {
    if (segments.length === 0) return [];
    return this.runUnfrozenRun(segments, sheet, geometry);
  }

  /**
   * Splits the segments into runs separated by frozen markers, re-pipes
   * each unfrozen run independently under the given sheet, and stitches
   * frozen segments back in their original positions. The splitter
   * pipeline cannot reach across a frozen segment, so a frozen scene is
   * an immovable boundary the user explicitly shaped — and any segment
   * the user styled is implicitly frozen, so its identity (and the
   * overrides keyed by it) survives the reflow.
   */
  reflowSection(
    segments: ReadonlyArray<Segment>,
    sheet: Sheet,
    ctx: DocumentDeriverContext,
  ): Segment[] {
    const out: Segment[] = [];
    let runBuffer: Segment[] = [];
    const flushRun = (): void => {
      if (runBuffer.length === 0) return;
      out.push(...this.runUnfrozenRun(runBuffer, sheet, ctx));
      runBuffer = [];
    };
    for (const seg of segments) {
      if (ctx.segmentOverrides.isFrozen(seg.id)) {
        flushRun();
        out.push(seg);
      } else {
        runBuffer.push(seg);
      }
    }
    flushRun();
    return out;
  }

  private runUnfrozenRun(
    segments: ReadonlyArray<Segment>,
    sheet: Sheet,
    geometry: DerivationGeometry,
  ): Segment[] {
    const merged = this.mergeIntoSingleSegment(segments);
    const segmentPipeline = this.segmentSplitters.buildPipeline(sheet.segmentSplitterConfigs, {
      fontSize: sheet.typographyConfig.fontSize,
      referenceFontSize: sheet.template.typography.fontSize,
    });
    const segmented = segmentPipeline.split([merged]);
    const lineSplitter = this.lineSplitters.build(sheet.lineSplitterConfig, {
      css: sheet.template.getCss(),
      cssVars: this.sheetCssVarsBuilder.build(sheet),
      videoWidth: geometry.videoWidth,
      videoHeight: geometry.videoHeight,
    });
    const piped = lineSplitter.split(segmented);
    return this.preserveInputIds(piped, segments);
  }

  private mergeIntoSingleSegment(segments: ReadonlyArray<Segment>): Segment {
    const allWords = segments.flatMap((s) => s.getWords());
    return new Segment({ lines: [new Line({ words: allWords })] });
  }

  /**
   * Restores segment identity where the pipeline produced a segment whose
   * word-id sequence matches one of the inputs verbatim — same words in the
   * same order, only line breaks or css vars may have changed. Outputs
   * without a match keep the fresh id they got from the pipeline.
   *
   * Words are partitioned across segments and Word instances survive the
   * pipeline (the deriver only regroups, never creates or removes them), so
   * a word-id sequence uniquely identifies the conceptual segment it came
   * from. This is what lets per-segment-id state (virtualizer height
   * cache, style overrides, freeze flags) survive a re-derivation without
   * any feature-aware code in the deriver.
   */
  private preserveInputIds(output: Segment[], input: ReadonlyArray<Segment>): Segment[] {
    const idByWordSequence = new Map<string, string>();
    for (const seg of input) {
      const key = this.wordIdSequence(seg);
      if (key.length > 0) idByWordSequence.set(key, seg.id);
    }
    return output.map((seg) => {
      const inputId = idByWordSequence.get(this.wordIdSequence(seg));
      return inputId !== undefined && inputId !== seg.id ? seg.with({ id: inputId }) : seg;
    });
  }

  private wordIdSequence(segment: Segment): string {
    return segment.getWords().map((w) => w.id).join('|');
  }

  /**
   * Runs the enabled effects of every sheet over the full document, in
   * sheet-then-effect order. Each effect is built fresh from its config
   * and given a `segmentFilter` that scopes mutations to its own sheet's
   * sections — the effect still sees the whole document for context (e.g.
   * `GapFreeEffect` looks at the next segment regardless of which sheet
   * owns it). Disabled effects are skipped, so toggling `enabled: false`
   * naturally restores the prior state on the next derivation.
   */
  private applyEffects(
    document: Document,
    sheets: ReadonlyArray<Sheet>,
    videoDurationSeconds: number,
  ): Document {
    let result = this.resetWordOverrides(document);
    const sectionKindBySegmentId = this.indexSectionKindBySegmentId(result);
    for (const sheet of sheets) {
      const segmentFilter = (segment: Segment): boolean => sectionKindBySegmentId.get(segment.id) === sheet.id;
      for (const config of sheet.effectConfigs) {
        if (!config.enabled) continue;
        const effect = this.effects.build(config, { segmentFilter, videoDurationSeconds });
        result = effect.apply(result);
      }
    }
    return result;
  }

  private indexSectionKindBySegmentId(document: Document): Map<string, string> {
    const out = new Map<string, string>();
    for (const section of document.sections) {
      for (const segment of section.segments) out.set(segment.id, section.kind);
    }
    return out;
  }

  private resetWordOverrides(document: Document): Document {
    return document.with({ sections: document.sections.map((section) =>
      section.with({ segments: section.segments.map((segment) =>
        segment.with({ lines: segment.lines.map((line) =>
          line.with({ words: line.words.map((word) => word.with({ displayText: word.text })) }),
        ) }),
      ) }),
    ) });
  }

  /**
   * Walks `document` and re-applies the per-decoration glyph override
   * and resolved `customTime` to every decorated word. The host word
   * stays the same instance when neither the glyph nor the time would
   * change.
   */
  private applyDecorationOverrides(
    document: Document,
    sheetById: ReadonlyMap<string, Sheet>,
    decorationOverrides: DecorationOverrideRegistry,
  ): Document {
    return document.with({ sections: document.sections.map((section) => {
      const sheet = sheetById.get(section.kind);
      if (!sheet) return section;
      return section.with({ segments: section.segments.map((segment) =>
        segment.with({ lines: segment.lines.map((line) =>
          line.with({ words: line.words.map((word) => this.rebuildWordDecoration(word, sheet, segment, decorationOverrides)) }),
        ) }),
      ) });
    }) });
  }

  private rebuildWordDecoration(
    word: Word,
    sheet: Sheet,
    segment: Segment,
    decorationOverrides: DecorationOverrideRegistry,
  ): Word {
    const decoration = word.decoration;
    if (!decoration) return word;
    const glyph = decorationOverrides.get(decoration.id).glyph ?? decoration.glyph;
    const customTime = this.decorationTimeResolver.resolve(sheet, segment);
    if (glyph === decoration.glyph && this.sameTimeFragment(customTime, decoration.customTime)) return word;
    return word.with({ decoration: decoration.with({ glyph, customTime }) });
  }

  private sameTimeFragment(a: { start: number; end: number } | null, b: { start: number; end: number } | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.start === b.start && a.end === b.end;
  }

}
