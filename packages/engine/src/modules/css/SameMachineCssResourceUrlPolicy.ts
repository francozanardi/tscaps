import type { CssResourceUrlPolicy } from '@modules/css/CssResourceUrlPolicy';

/**
 * Fetches only what is already on this machine: `blob:` objects the
 * page itself holds, and same-origin paths served beside it.
 *
 * For a host rendering a stylesheet somebody else wrote. There, every
 * `url()` naming a remote address is an outbound request made by us,
 * to an address of their choosing, with the response folded back into
 * the picture — so a stylesheet becomes a way to have our machine
 * fetch things and show us what came back. Nothing legitimate needs
 * it: fonts arrive as blobs and assets are served alongside the page.
 *
 * A refused reference is left in the CSS untouched rather than
 * stripped. It resolves to nothing when the SVG is decoded, which is
 * the same outcome as a resource that failed to load, and keeps this
 * from having to understand the shape of the rule it sits in.
 */
export class SameMachineCssResourceUrlPolicy implements CssResourceUrlPolicy {
  constructor(private readonly origin: string) {}

  allows(url: string): boolean {
    if (url.startsWith('blob:')) return true;
    try {
      return new URL(url, this.origin).origin === this.origin;
    } catch {
      return false;
    }
  }
}
