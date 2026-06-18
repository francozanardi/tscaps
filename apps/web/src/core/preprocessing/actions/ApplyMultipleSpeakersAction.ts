import { Document, DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver, DocumentDeriverContext } from '@core/editor/services/DocumentDeriver';
import type { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import type { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { SpeakerChangeSegmentSplitterConfig } from '@core/segment-splitter/domain/SpeakerChangeSegmentSplitterConfig';
import { Sheet, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { Template } from '@core/templates/domain/Template';

const docEditor = new DocumentEditor();

/**
 * Applies the StartDialog's multi-speaker opt-in to the freshly
 * transcribed editing session. Always aligns the main sheet's
 * `speaker_change` splitter with the user's choice; when the user
 * opted in and the transcription carries at least two distinct
 * speakers, also renames `main` to "Speaker 1", spawns one fresh
 * sheet per additional speaker and routes each mono-speaker segment
 * to its sheet. Words without speaker attribution stay on Speaker 1.
 *
 * When the user opts in and the current main template ships fewer
 * than two `variants`, main is swapped to the first available
 * template that ships at least two, so the session lands on a
 * template designed for the feature. Each speaker sheet is then
 * pinned to a different variant (cyclic by index), which seeds its
 * `styleValues` with that variant's overrides.
 *
 * Runs without committing to the undo stack — preprocessing is not
 * meant to be reversible.
 */
export class ApplyMultipleSpeakersAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly palette: SheetColorPalette,
    private readonly speakerMatcher: SpeakerSheetMatcher,
  ) {}

  execute(multipleSpeakers: boolean): void {
    const { document, sheets, availableTemplates, video, segmentOverrides, decorationOverrides } = this.store.snapshot();
    if (!document) return;
    if (!video.layout) return;

    const main = sheets.find((s) => s.id === MAIN_SHEET_ID);
    if (!main) return;

    const mainOnMultiSpeakerTemplate = multipleSpeakers
      ? this._ensureMultiSpeakerTemplate(main, availableTemplates)
      : main;
    const mainWithSplitter = this._withSpeakerSplitterEnabled(mainOnMultiSpeakerTemplate, multipleSpeakers);
    const otherSheets = sheets.filter((s) => s.id !== MAIN_SHEET_ID);

    if (!multipleSpeakers) {
      this.store.patch({ sheets: [mainWithSplitter, ...otherSheets] });
      return;
    }

    const ctx: DocumentDeriverContext = {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      segmentOverrides,
      decorationOverrides,
    };
    const sheetsAfterFlip = [mainWithSplitter, ...otherSheets];
    const derived = this.deriver.derive(document, sheetsAfterFlip, ctx);

    const speakerIds = this._collectAttributedSpeakerIds(derived);
    if (speakerIds.length < 2) {
      this.store.patch({ sheets: sheetsAfterFlip, document: derived });
      return;
    }

    const speakerSheets = this._buildSpeakerSheets(mainWithSplitter, otherSheets, speakerIds.length);
    const renamedMain = speakerSheets[0]!;
    const extraSpeakerSheets = speakerSheets.slice(1);
    const allSheets = [renamedMain, ...otherSheets, ...extraSpeakerSheets];

    const speakerToSheetId = this._mapSpeakersToSheets(speakerIds, speakerSheets);
    const reassigned = this._reassignSegmentsBySpeaker(derived, speakerToSheetId);
    const retagged = this.deriver.retag(reassigned);

    this.store.patch({ sheets: allSheets, document: retagged });
  }

  /**
   * Returns the sheet on a multi-speaker-capable template. If the
   * current template already ships at least two variants, the sheet
   * is returned unchanged; otherwise main is rebased onto the first
   * available template that does. If no available template ships
   * variants, the sheet is returned unchanged and the rest of the
   * flow degrades to identical-looking speaker sheets.
   */
  private _ensureMultiSpeakerTemplate(sheet: Sheet, available: ReadonlyArray<Template>): Sheet {
    if (sheet.template.variants.length >= 2) return sheet;
    const compatible = available.find((t) => t.variants.length >= 2);
    if (!compatible) return sheet;
    return sheet.withTemplate(compatible);
  }

  private _withSpeakerSplitterEnabled(sheet: Sheet, enabled: boolean): Sheet {
    const updated: ReadonlyArray<SegmentSplitterConfig> = sheet.segmentSplitterConfigs.map((cfg) => {
      if (cfg.type !== 'speaker_change') return cfg;
      const flipped: SpeakerChangeSegmentSplitterConfig = { type: 'speaker_change', enabled };
      return flipped;
    });
    return sheet.with({ segmentSplitterConfigs: updated });
  }

  private _collectAttributedSpeakerIds(document: Document): string[] {
    return this.speakerMatcher
      .collectSpeakerIds(document)
      .filter((id): id is string => id !== null);
  }

  /**
   * Builds the ordered list of sheets that back each detected speaker:
   * index 0 is `main` renamed to "Speaker 1" (id preserved), and
   * subsequent entries are fresh sheets cloned from the same base.
   * Every sheet receives a distinct UI accent from the shared sheet
   * color palette and is pinned to a different style variant
   * (cyclic by index) so each speaker reads its own preset.
   */
  private _buildSpeakerSheets(
    base: Sheet,
    existingOthers: ReadonlyArray<Sheet>,
    speakerCount: number,
  ): Sheet[] {
    const usedColors: (string | null)[] = existingOthers.map((s) => s.color);
    const sheets: Sheet[] = [];
    for (let i = 0; i < speakerCount; i++) {
      const color = this.palette.pickColor(usedColors);
      usedColors.push(color);
      const draft = i === 0
        ? base.with({ name: 'Speaker 1', color })
        : base.with({ id: crypto.randomUUID(), name: `Speaker ${i + 1}`, color });
      sheets.push(draft.withVariant(i));
    }
    return sheets;
  }

  private _mapSpeakersToSheets(
    speakerIds: ReadonlyArray<string>,
    speakerSheets: ReadonlyArray<Sheet>,
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (let i = 0; i < speakerIds.length; i++) {
      map.set(speakerIds[i]!, speakerSheets[i]!.id);
    }
    return map;
  }

  private _reassignSegmentsBySpeaker(
    derived: Document,
    speakerToSheetId: ReadonlyMap<string, string>,
  ): Document {
    const moves = this._planMoves(derived, speakerToSheetId);
    let doc = derived;
    for (const move of moves) {
      const segment = doc.getSegments().find((s) => s.id === move.segmentId);
      if (!segment) continue;
      doc = docEditor.replaceSegmentWithKind(doc, move.segmentId, [segment], move.targetSheetId);
    }
    return doc;
  }

  private _planMoves(
    derived: Document,
    speakerToSheetId: ReadonlyMap<string, string>,
  ): ReadonlyArray<{ readonly segmentId: string; readonly targetSheetId: string }> {
    const moves: { readonly segmentId: string; readonly targetSheetId: string }[] = [];
    for (const segment of derived.getSegments()) {
      // Speaker routing only partitions the Main content stream; segments
      // already routed to a non-Main sheet by an earlier preprocessing step
      // (e.g. the auto Hook sheet) must keep their assignment.
      if (segment.getSection().kind !== MAIN_SHEET_ID) continue;
      const words = segment.getWords();
      if (words.length === 0) continue;
      const speakerId = words[0]!.speakerId;
      if (speakerId === null) continue;
      const targetSheetId = speakerToSheetId.get(speakerId);
      if (!targetSheetId) continue;
      if (segment.getSection().kind === targetSheetId) continue;
      moves.push({ segmentId: segment.id, targetSheetId });
    }
    return moves;
  }
}
