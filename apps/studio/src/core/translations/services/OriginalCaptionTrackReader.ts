import type { Document } from '@tscaps/engine';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { ORIGINAL_CAPTION_TRACK_ID, type CaptionTrack } from '@core/translations/domain/CaptionTrack';

/** The Original track's words, the sheets its sections route to, and its emoji edits. */
export interface OriginalCaptions {
  readonly document: Document | null;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly decorationOverrides: DecorationOverrideRegistry;
}

/** What the Original track is read from: the editor state, or a project. */
export interface OriginalCaptionsSource {
  /** The active track's document. */
  readonly document: Document | null;
  /** The active track's sheets. */
  readonly sheets: ReadonlyArray<Sheet>;
  /** The active track's emoji edits. */
  readonly decorationOverrides: DecorationOverrideRegistry;
  readonly captionTracks: ReadonlyArray<CaptionTrack>;
  readonly activeCaptionTrackId: string | null;
}

/**
 * Reads what is said in the video — the Original caption track —
 * whatever caption track is active.
 *
 * `EditorState.document` is the active track's document, which is a
 * translation's while one is active: its words are another language and
 * its times are approximated. Anything about the video rather than the
 * captions reads its words here instead.
 *
 * While the Original track is active, or there is no track yet, the
 * answer is the editor state's own `document`, `sheets` and
 * `decorationOverrides`, by identity, so a consumer memoising on them
 * recomputes exactly as before. A state with a translation active and
 * no Original track has no words to give.
 */
export class OriginalCaptionTrackReader {
  private static readonly NO_SHEETS: ReadonlyArray<Sheet> = [];
  private static readonly NO_DECORATION_OVERRIDES = DecorationOverrideRegistry.empty();

  read(state: OriginalCaptionsSource): OriginalCaptions {
    if (state.activeCaptionTrackId === null || state.activeCaptionTrackId === ORIGINAL_CAPTION_TRACK_ID) {
      return { document: state.document, sheets: state.sheets, decorationOverrides: state.decorationOverrides };
    }
    const original = state.captionTracks.find((track) => track.id === ORIGINAL_CAPTION_TRACK_ID);
    if (!original) {
      return { document: null, sheets: OriginalCaptionTrackReader.NO_SHEETS, decorationOverrides: OriginalCaptionTrackReader.NO_DECORATION_OVERRIDES };
    }
    return { document: original.document, sheets: original.sheets, decorationOverrides: original.decorationOverrides };
  }
}
