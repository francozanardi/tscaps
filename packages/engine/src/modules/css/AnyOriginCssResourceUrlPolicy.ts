import type { CssResourceUrlPolicy } from '@modules/css/CssResourceUrlPolicy';

/**
 * Fetches whatever the stylesheet names, wherever it lives.
 *
 * The right answer where the stylesheet and the machine fetching it
 * belong to the same person — someone editing their own captions in
 * their own browser, who may reasonably point at a font or an image on
 * the open web and expects to see it.
 */
export class AnyOriginCssResourceUrlPolicy implements CssResourceUrlPolicy {
  allows(_url: string): boolean {
    return true;
  }
}
