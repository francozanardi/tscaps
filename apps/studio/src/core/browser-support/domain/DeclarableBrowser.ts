import type { BrowserName } from '@shared/browser';

/**
 * A browser a template may declare itself unrenderable in: every
 * `BrowserName` except `'unknown'`, which is the inspector's "no
 * verdict" answer and restricts nothing, plus `'safari-before-26'`,
 * a WebKit older than release 26.
 */
export type DeclarableBrowser = Exclude<BrowserName, 'unknown'> | 'safari-before-26';

/**
 * The browsers this app distinguishes, as the slugs a `template.json`
 * writes in `unsupportedBrowsers`.
 *
 * Each names a rendering engine as much as a brand: `safari` is every
 * WebKit runtime, iOS Chrome and iOS Firefox included, because on iOS
 * every browser paints with WebKit. `safari-before-26` is the part of
 * that which predates WebKit 26 (Safari 18 and older, and every browser
 * on iOS or iPadOS 18 and older); a template that renders wrong only
 * there names it instead of `safari`.
 *
 * The `satisfies` is the guard: this list and `BrowserName` are two
 * halves of one vocabulary, and a browser added to one and not the
 * other fails to compile rather than becoming a slug that silently
 * matches nothing. That is what lets the list be restated here rather
 * than derived — what a template may declare is a different question
 * than what the inspector may answer: `'unknown'` is never declarable,
 * and `'safari-before-26'` is answered by a check of the engine, not
 * by the inspector.
 */
export const DECLARABLE_BROWSERS = {
  chrome: true,
  edge: true,
  firefox: true,
  safari: true,
  opera: true,
  'safari-before-26': true,
} as const satisfies Readonly<Record<DeclarableBrowser, true>>;

export const DECLARABLE_BROWSER_NAMES = Object.keys(DECLARABLE_BROWSERS) as DeclarableBrowser[];
