import type { BrowserName } from '@shared/browser';

/**
 * A browser a template may declare itself unrenderable in — every
 * `BrowserName` except `'unknown'`, which is the inspector's "no
 * verdict" answer and restricts nothing.
 */
export type DeclarableBrowser = Exclude<BrowserName, 'unknown'>;

/**
 * The browsers this app distinguishes, as the slugs a `template.json`
 * writes in `unsupportedBrowsers`.
 *
 * Each names a rendering engine as much as a brand: `safari` is every
 * WebKit runtime, iOS Chrome and iOS Firefox included, because on iOS
 * every browser paints with WebKit.
 *
 * The `satisfies` is the guard: this list and `BrowserName` are two
 * halves of one vocabulary, and a browser added to one and not the
 * other fails to compile rather than becoming a slug that silently
 * matches nothing. That is what lets the list be restated here rather
 * than derived — what a template may declare is a narrower question
 * than what the inspector may answer, and `'unknown'` is the
 * difference.
 */
export const DECLARABLE_BROWSERS = {
  chrome: true,
  edge: true,
  firefox: true,
  safari: true,
  opera: true,
} as const satisfies Readonly<Record<DeclarableBrowser, true>>;

export const DECLARABLE_BROWSER_NAMES = Object.keys(DECLARABLE_BROWSERS) as DeclarableBrowser[];
