import { Document, DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver, DocumentDeriverContext } from '@core/editor/services/DocumentDeriver';
import type { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import type { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { SpeakerChangeSegmentSplitterConfig } from '@core/segment-splitter/domain/SpeakerChangeSegmentSplitterConfig';
import { Sheet, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

const docEditor = new DocumentEditor();

/**
 * Applies the StartDialog's multi-speaker opt-in to the freshly
 * transcribed editing session. Always aligns the main sheet's
 * `speaker_change` splitter with the user's choice; when the user
 * opted in and the transcription carries at least two distinct
 * speakers, also renames `main` to "Speaker 1", spawns one fresh
 * sheet per additional speaker (cloned from main) and routes each
 * mono-speaker segment to its sheet. Words without speaker
 * attribution stay on Speaker 1.
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
    const { document, sheets, video, segmentOverrides } = this.store.snapshot();
    if (!document) return;
    if (!video.layout) return;

    const main = sheets.find((s) => s.id === MAIN_SHEET_ID);
    if (!main) return;

    const mainWithSplitter = this._withSpeakerSplitterEnabled(main, multipleSpeakers);
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
    };
    const sheetsAfterFlip = [mainWithSplitter, ...otherSheets];
    const derived = this.deriver.derive(document, sheetsAfterFlip, ctx);

    const speakerIds = this._collectAttributedSpeakerIds(derived);
    if (speakerIds.length < 2) {
      this.store.patch({ sheets: sheetsAfterFlip, document: derived });
      return;
    }

    const renamedMain = mainWithSplitter.with({ name: 'Speaker 1' });
    const extraSpeakerSheets = this._buildExtraSpeakerSheets(renamedMain, otherSheets, speakerIds.length - 1);
    const allSheets = [renamedMain, ...otherSheets, ...extraSpeakerSheets];

    const speakerToSheetId = this._mapSpeakersToSheets(speakerIds, extraSpeakerSheets);
    const reassigned = this._reassignSegmentsBySpeaker(derived, speakerToSheetId);
    const retagged = this.deriver.retag(reassigned);

    this.store.patch({ sheets: allSheets, document: retagged });
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

  private _buildExtraSpeakerSheets(
    base: Sheet,
    existingOthers: ReadonlyArray<Sheet>,
    count: number,
  ): Sheet[] {
    const usedColors: (string | null)[] = [base.color, ...existingOthers.map((s) => s.color)];
    const created: Sheet[] = [];
    for (let i = 0; i < count; i++) {
      const color = this.palette.pickColor(usedColors);
      usedColors.push(color);
      created.push(base.with({
        id: crypto.randomUUID(),
        name: `Speaker ${i + 2}`,
        color,
      }));
    }
    return created;
  }

  private _mapSpeakersToSheets(
    speakerIds: ReadonlyArray<string>,
    extraSpeakerSheets: ReadonlyArray<Sheet>,
  ): Map<string, string> {
    const map = new Map<string, string>();
    map.set(speakerIds[0]!, MAIN_SHEET_ID);
    for (let i = 1; i < speakerIds.length; i++) {
      map.set(speakerIds[i]!, extraSpeakerSheets[i - 1]!.id);
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
