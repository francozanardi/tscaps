import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import type { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';

/**
 * Keeps every sheet's writing systems in step with the text its sections
 * actually hold, so they can be trusted wherever a sheet is read.
 *
 * Classification is a pure function of the document, so this runs on
 * every re-derivation rather than once: the answer can never go stale,
 * and there is no user choice to overwrite. It reads all of a sheet's
 * text at once because that is the only sample large enough to tell
 * which language an Arabic-script sheet is written in. Sheets whose
 * scripts did not change keep their identity, so downstream memoization
 * is undisturbed; when nothing changed the input array itself is
 * returned.
 */
export class SheetScriptsSynchronizer {

  constructor(
    private readonly scriptClassifier: FontScriptClassifier,
    private readonly captionTextCollector: SheetCaptionTextCollector,
  ) {}

  sync(document: Document, sheets: ReadonlyArray<Sheet>): ReadonlyArray<Sheet> {
    let changed = false;
    const synced = sheets.map((sheet) => {
      const text = this.captionTextCollector.collect(document, sheet.id);
      const scripts = new CaptionScripts(
        this.scriptClassifier.classifyWithLanguage(text),
        this.scriptClassifier.scriptsIn(text),
        this.scriptClassifier.readsAsUrdu(text),
        this.scriptClassifier.otherLetterCodepoints(text),
      );
      if (scripts.equals(sheet.scripts)) return sheet;
      changed = true;
      return sheet.with({ scripts });
    });
    return changed ? synced : sheets;
  }
}
