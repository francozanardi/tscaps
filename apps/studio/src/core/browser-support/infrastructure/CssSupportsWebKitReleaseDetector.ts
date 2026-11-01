import type { WebKitReleaseDetector } from '@core/browser-support/domain/WebKitReleaseDetector';

/**
 * CSS that WebKit first shipped in release 26: anchor positioning and
 * `contrast-color()`. A WebKit that supports neither predates it.
 */
const WEBKIT_26_DECLARATIONS = ['anchor-name: --tscaps-anchor', 'color: contrast-color(red)'];

/**
 * `WebKitReleaseDetector` that asks `CSS.supports` for CSS WebKit 26
 * introduced.
 *
 * Not read from the user agent, because the user agent does not carry
 * it on iOS: from iOS 26 every iPhone and iPad reports `OS 18_7`, and
 * the browsers other than Safari (Chrome's `CriOS`, Firefox's `FxiOS`)
 * carry no `Version/` token either, so an iPhone on iOS 18.7 and one on
 * iOS 27 read the same. What CSS the engine parses is fixed by the
 * WebKit build itself, and every browser on iOS shares the system's.
 */
export class CssSupportsWebKitReleaseDetector implements WebKitReleaseDetector {

  constructor(private readonly css: { supports(conditionText: string): boolean }) {}

  isBefore26(): boolean {
    return !WEBKIT_26_DECLARATIONS.some((declaration) => this.css.supports(declaration));
  }
}
