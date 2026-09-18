import type { Document } from '@tscaps/engine';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';

const STYLE_MARKER = 'data-tscaps-compiled-fonts';

interface FontFaceRegistrationContext {
  readonly sheets: ReadonlyArray<Sheet>;
  readonly document: Document;
  readonly elementStyles: ElementStyles;
}

/**
 * Keeps the page's `@font-face` rules for compiled font families in
 * step with the sheets being edited.
 *
 * A compiled family is named by this app and defined nowhere else, so
 * the page has to be told about it. It cannot be told during a render:
 * replacing a `<style>` element unregisters every face it declared and
 * the browser fetches them again, which is a request storm when the
 * text is rebuilt on every derivation — and, since a font arriving is
 * itself a reason to re-derive, a loop that never settles.
 *
 * So the rules are written into one `<style>` of their own and the DOM
 * is touched only when the text actually changes. A derivation that
 * leaves the fonts alone — which is nearly all of them — writes
 * nothing.
 */
export class CompiledFontFaceRegistrar {

  private latest: FontFaceRegistrationContext | null = null;
  private registered = '';
  private style: HTMLStyleElement | null = null;

  constructor(private readonly sheetFontFacesBuilder: SheetFontFacesBuilder) {}

  /**
   * Rules for every sheet, fetched by URL rather than embedded, so the
   * browser skips a subset the captions never reach on its own.
   */
  reconcile(sheets: ReadonlyArray<Sheet>, document: Document, elementStyles: ElementStyles): void {
    this.latest = { sheets, document, elementStyles };
    globalThis.document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
    const css = sheets.map((sheet) => this.sheetFontFacesBuilder.build({
      sheet,
      document,
      sheetCss: sheet.resolveCss(),
      elementStyles,
      usedCodepoints: null,
    })).filter((rules) => rules !== '').join('\n');
    if (css === this.registered) return;
    this.registered = css;
    if (css !== '') this.write(css);
  }

  stop(): void {
    globalThis.document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
    this.latest = null;
    this.style?.remove();
    this.style = null;
    this.registered = '';
  }

  // A text edit may introduce an unloaded face without running a document refresh.
  // Only rebuild the font rules when loading settles; cached metrics and identical
  // CSS keep subsequent loading events from causing more DOM writes.
  private readonly onFontsLoaded = (): void => {
    if (this.latest === null) return;
    const { sheets, document, elementStyles } = this.latest;
    this.reconcile(sheets, document, elementStyles);
  };

  private write(css: string): void {
    if (this.style === null) {
      this.style = globalThis.document.createElement('style');
      this.style.setAttribute(STYLE_MARKER, '');
      globalThis.document.head.appendChild(this.style);
    }
    this.style.textContent = css;
  }
}
