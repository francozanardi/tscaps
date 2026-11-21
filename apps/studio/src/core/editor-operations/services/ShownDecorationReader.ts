import type { Document } from '@tscaps/engine';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * The emojis a read speaks of: those the captions show, and the
 * suggestions they would show once automatic emojis are on. A suggestion
 * its caption would not show in the captions as they are split now is in
 * neither: it is the editor's own business, and nobody asked for it.
 */
export interface CaptionEmojis {
  readonly shown: ReadonlySet<string>;
  readonly suggested: ReadonlySet<string>;
}

/**
 * Which emojis the captions actually show. Transcription can suggest an
 * emoji on many words; a sheet shows them only while its automatic
 * emojis are on, and then one per caption at most, while an emoji the
 * person added or edited always shows, in its caption's place. A reader that took every emoji
 * on a word for one on screen would describe captions nobody sees.
 */
export class ShownDecorationReader {
  constructor(private readonly filter: DecorationFilter) {}

  /** The ids of the emojis the captions in `state` show. */
  shownIds(state: EditorState): ReadonlySet<string> {
    if (state.document === null) return new Set();
    return this.idsIn(this.filter.filterDocument(state.document, state.sheets, state.decorationOverrides));
  }

  /** The emojis the captions in `state` show, and the suggestions they would show once automatic emojis are on. */
  emojisOf(state: EditorState): CaptionEmojis {
    const shown = this.shownIds(state);
    if (state.document === null) return { shown, suggested: new Set() };
    const sheets = state.sheets.map((sheet) => this.withAutomaticEmojis(sheet));
    const wouldShow = this.idsIn(this.filter.filterDocument(state.document, sheets, state.decorationOverrides));
    return { shown, suggested: new Set([...wouldShow].filter((id) => !shown.has(id))) };
  }

  private withAutomaticEmojis(sheet: Sheet): Sheet {
    const emoji = sheet.effectConfig('emoji');
    if (emoji?.enabled === true) return sheet;
    const others = sheet.effectConfigs.filter((config) => config.type !== 'emoji');
    const on = { type: 'emoji' as const, placement: EMOJI_PLACEMENT_DEFAULT, size: EMOJI_SIZE_DEFAULT, gap: EMOJI_GAP_DEFAULT, ...emoji, enabled: true };
    return sheet.with({ effectConfigs: [...others, on] });
  }

  private idsIn(document: Document): ReadonlySet<string> {
    return new Set(document.getWords().flatMap((word) => (word.decoration === null ? [] : [word.decoration.id])));
  }
}
