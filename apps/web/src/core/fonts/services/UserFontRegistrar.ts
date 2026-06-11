import type { FontUserBlob, UserBlob } from '@core/user-blobs/domain/UserBlob';
import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';
import type { UserBlobsStore } from '@core/user-blobs/store/UserBlobsStore';

/**
 * Injects a `<style>` element per uploaded font, each carrying an
 * `@font-face` rule that points at the resolver's runtime URL for
 * that font. Going through `<style>` (rather than the `FontFace` API
 * directly) keeps the rules visible to `document.styleSheets`, which
 * is what the export pipeline's `BrowserStyleSheetFontFaceReader`
 * walks to resolve fonts — `document.fonts` additions don't appear
 * there.
 *
 * The registrar is a passive subscriber: every time
 * `UserBlobsStore` publishes a new snapshot it diff-reconciles the
 * DOM so the live `<style>` tags exactly mirror the current set of
 * font blobs. No font-specific actions touch the DOM directly.
 */
export class UserFontRegistrar {
  private readonly registeredBlobIds = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly store: UserBlobsStore,
    private readonly urlResolver: UserBlobUrlResolver,
  ) {}

  start(): void {
    if (this.unsubscribe !== null) return;
    const onChange = () => this.reconcile();
    this.store.addEventListener('change', onChange);
    this.unsubscribe = () => this.store.removeEventListener('change', onChange);
    this.reconcile();
  }

  stop(): void {
    if (this.unsubscribe === null) return;
    this.unsubscribe();
    this.unsubscribe = null;
    for (const id of [...this.registeredBlobIds]) this.unregister(id);
  }

  private reconcile(): void {
    const fonts = this.snapshotFonts();
    const desiredIds = new Set(fonts.map((font) => font.id));
    for (const id of [...this.registeredBlobIds]) {
      if (!desiredIds.has(id)) this.unregister(id);
    }
    for (const font of fonts) {
      if (!this.registeredBlobIds.has(font.id)) this.register(font);
    }
  }

  private snapshotFonts(): FontUserBlob[] {
    return this.store.snapshot().filter(isFontBlob);
  }

  private register(font: FontUserBlob): void {
    const url = this.urlResolver.resolve(font.id);
    if (url === null) return;
    const css = `@font-face { font-family: '${font.family}'; src: url(${url}) format('${font.format}'); font-display: swap; }`;
    const style = document.createElement('style');
    style.dataset.userFontBlobId = font.id;
    style.textContent = css;
    document.head.appendChild(style);
    this.registeredBlobIds.add(font.id);
  }

  private unregister(blobId: string): void {
    const style = document.head.querySelector(
      `style[data-user-font-blob-id="${cssAttrEscape(blobId)}"]`,
    );
    style?.remove();
    this.registeredBlobIds.delete(blobId);
  }
}

function isFontBlob(blob: UserBlob): blob is FontUserBlob {
  return blob.kind === 'font';
}

function cssAttrEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}
