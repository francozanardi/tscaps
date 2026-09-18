import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import type { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { Sheet, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

/**
 * Gives one of the transcript's voices its own sheet and moves its
 * words onto it, leaving every other voice on Main. A scene two voices
 * share is carved between them; each side is re-split under its own
 * sheet's rules afterwards.
 *
 * The sheet is Main with three things changed: a color of its own, the
 * style preset matching the speaker's position, and membership of Main's
 * link group. Linked is the point — a speaker is not a different design,
 * it is the same design in a different colour, so one style edit still
 * reshapes the whole video while each voice keeps its preset. The chain
 * icon on the chip is there for anyone who wants one voice to diverge.
 *
 * Creating the sheet and moving the scenes are one gesture and share one
 * undo entry.
 */
export class CreateSpeakerSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly palette: SheetColorPalette,
    private readonly linkedSheetsSync: LinkedSheetsSync,
    private readonly runSheetMatcher: RunSheetMatcherAction,
    private readonly speakerSheetMatcher: SpeakerSheetMatcher,
    private readonly telemetry: Telemetry,
  ) {}

  /**
   * `position` is the speaker's place among the transcript's voices,
   * counted from the first, and decides which style preset the sheet
   * reads. `name` is what the chip shows until the user renames it.
   */
  execute(speakerId: string, name: string, position: number): string | null {
    const { sheets } = this.store.snapshot();
    const main = sheets.find((sheet) => sheet.id === MAIN_SHEET_ID);
    if (!main) return null;

    const linkGroupId = main.linkGroupId ?? crypto.randomUUID();
    const speakerSheet = this.buildSpeakerSheet(main, sheets, name, position, linkGroupId);
    const undoKey = `speaker-sheet:${speakerId}`;

    this.store.commit(undoKey);
    this.store.patch({
      sheets: [...sheets.map((sheet) => this.withGroup(sheet, main, linkGroupId)), speakerSheet],
      activeSheetId: speakerSheet.id,
    });

    const moved = this.runSheetMatcher.execute(
      speakerSheet.id,
      this.speakerSheetMatcher,
      { speakerId },
      undoKey,
    );
    this.refresh.execute();
    this.telemetry.capture('sheet_created', { source: 'speaker', position, moved_words: moved.movedCount });
    return speakerSheet.id;
  }

  /**
   * Main, on a colour and a preset of its own. The preset is applied
   * first and Main's look adopted over it, because switching preset
   * reseeds the style values from the template's defaults — taken alone
   * it would drop whatever the user had already changed on Main and hand
   * back a sheet that matches nothing.
   */
  private buildSpeakerSheet(
    main: Sheet,
    sheets: ReadonlyArray<Sheet>,
    name: string,
    position: number,
    linkGroupId: string,
  ): Sheet {
    const color = this.palette.pickColor(sheets.map((sheet) => sheet.color));
    const onOwnPreset = main
      .with({ id: crypto.randomUUID(), name, color, linkGroupId, role: null })
      .withVariant(position);
    return this.linkedSheetsSync.adoptGroupStyleFrom(onOwnPreset, main);
  }

  /** Main joins the group it is about to share; every other sheet is left as it is. */
  private withGroup(sheet: Sheet, main: Sheet, linkGroupId: string): Sheet {
    if (sheet.id !== main.id) return sheet;
    return sheet.linkGroupId === null ? sheet.with({ linkGroupId }) : sheet;
  }
}
