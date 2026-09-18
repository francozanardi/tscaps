import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import type { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';

/**
 * The writing systems a piece of caption text is written in, the one it
 * holds most characters of first — one row per alphabet the reader has
 * to choose a face for, in the order they should be offered.
 *
 * The same question at every scope: a sheet asks it of all its captions,
 * a segment or a word of its own text. Unsupported scripts share one
 * Other row; text carrying no letters at all answers Latin, which is
 * the face a stack is recognised by.
 */
export class ScriptRowResolver {

  constructor(private readonly scriptClassifier: FontScriptClassifier) {}

  /**
   * Pass `readsAsUrdu` from the settled language of the captions around
   * the text, never from the text itself: Urdu is the Arabic script in
   * another tradition, and the letters that mark it appear in some Urdu
   * words and not others. Asking a single word would answer Urdu for one
   * and Arabic for the next, offering two rows for one alphabet.
   */
  resolve(text: string, readsAsUrdu: boolean): FontFaceSlot[] {
    const scripts = this.scriptClassifier.fontFaceSlotsByUse(text);
    const rows: FontFaceSlot[] = readsAsUrdu
      ? scripts.map((script) => script === 'arabic' ? 'urdu' : script)
      : scripts;
    return rows.length === 0 ? ['latin'] : rows;
  }
}
