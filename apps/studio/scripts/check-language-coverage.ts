import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// The catalogues are read as text rather than imported. One of the two sits
// behind a `.close` suffix that the loader will not resolve, and a coverage
// check has no business depending on the module graph to answer a question
// about which letters exist.
const CATALOG_ENTRY = /nameEn:\s*'([^']+)',\s*nativeName:\s*'([^']+)'/g;

/**
 * Answers which offered transcription languages the bundle has no face
 * for, by reading the `unicode-range` of every `@font-face` the app
 * registers and testing each language's endonym against the union.
 *
 * The endonym is the sample because it is real text in the language's
 * own script, already curated beside the code. It samples the writing
 * system rather than the whole alphabet, which is the right resolution
 * for the question — a script is missing or it is not.
 *
 * A caption in a language reported here still renders: the browser
 * falls back to a system font. That is the problem, not the absence of
 * a glyph — the preview draws it from the reader's machine and a
 * container draws it from the image, so the two disagree.
 */

// Managed scripts other than Latin and Urdu, in Unicode's spelling. Urdu shares
// Arabic's code points; Latin is the family the stacks themselves are rooted on.
// A script listed here is reachable from every template, so it belongs in
// neither report: every stack names a face for it whatever the reader picked.
const MANAGED_SCRIPT_NAMES = new Set([
  'Arabic', 'Hebrew', 'Cyrillic', 'Greek', 'Devanagari', 'Bengali', 'Telugu', 'Tamil', 'Thai',
]);

const IMPORT = /@import\s+'([^']+)'/g;
const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const FAMILY = /font-family:\s*['"]?([^'";]+?)['"]?\s*;/;
const UNICODE_RANGE = /unicode-range:\s*([^;}]+)/;
const RANGE = /U\+([0-9a-f]+)(?:-([0-9a-f]+))?/gi;

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const require = createRequire(join(repoRoot, 'apps/studio/package.json'));

/** Every `@font-face` source the catalogue stylesheet pulls in. */
function readCatalogCss(): string {
  const stylesheet = readFileSync(join(repoRoot, 'apps/studio/src/styles/fonts.css'), 'utf8');
  const parts: string[] = [stylesheet];
  for (const [, specifier] of stylesheet.matchAll(IMPORT)) {
    parts.push(readFileSync(resolvePackageCss(specifier!), 'utf8'));
  }
  return parts.join('\n');
}

/**
 * The file a bare `@import` of a font package resolves to. A specifier
 * naming a stylesheet is taken as it is; a bare package name means the
 * package's default entry, which Fontsource publishes as `index.css`.
 */
function resolvePackageCss(specifier: string): string {
  if (specifier.endsWith('.css')) return require.resolve(specifier);
  return join(dirname(require.resolve(`${specifier}/package.json`)), 'index.css');
}

/**
 * What each family declares it can draw, keyed by family name.
 *
 * Per family and not as one union, because a registered `@font-face` a
 * caption's stack never names is a face the browser will not reach for.
 * Poppins carries Devanagari; a caption set in Anton does not, and a
 * union would call Hindi covered on the strength of a font the reader
 * did not choose.
 */
function readCoverageByFamily(css: string): Map<string, Set<number>> {
  const byFamily = new Map<string, Set<number>>();
  for (const [, block] of css.matchAll(FONT_FACE)) {
    const family = FAMILY.exec(block!)?.[1];
    const ranges = UNICODE_RANGE.exec(block!)?.[1];
    if (!family || !ranges) continue;
    const covered = byFamily.get(family) ?? new Set<number>();
    for (const [, from, to] of ranges.matchAll(RANGE)) {
      const start = parseInt(from!, 16);
      const end = to ? parseInt(to, 16) : start;
      for (let point = start; point <= end; point++) covered.add(point);
    }
    byFamily.set(family, covered);
  }
  return byFamily;
}

/** The Unicode script a character belongs to, as a coarse label for grouping. */
function scriptOf(character: string): string {
  const scripts = [
    'Han', 'Hiragana', 'Katakana', 'Hangul', 'Thai', 'Devanagari', 'Bengali', 'Tamil',
    'Telugu', 'Kannada', 'Malayalam', 'Gujarati', 'Gurmukhi', 'Oriya', 'Sinhala',
    'Myanmar', 'Khmer', 'Lao', 'Ethiopic', 'Georgian', 'Armenian', 'Cyrillic',
    'Greek', 'Arabic', 'Hebrew', 'Thaana', 'Tibetan', 'Mongolian', 'Cherokee', 'Latin',
  ];
  for (const script of scripts) {
    if (new RegExp(`\\p{Script=${script}}`, 'u').test(character)) return script;
  }
  return 'Other';
}

/** The languages one catalogue offers, as English name and endonym. */
function readCatalog(file: string): ReadonlyArray<{ nameEn: string; nativeName: string }> {
  const source = readFileSync(join(repoRoot, 'shared/transcription-languages', file), 'utf8');
  return [...source.matchAll(CATALOG_ENTRY)].map(([, nameEn, nativeName]) => ({
    nameEn: nameEn!,
    nativeName: nativeName!,
  }));
}

const coverageByFamily = readCoverageByFamily(readCatalogCss());

const languages = [
  ...readCatalog('WhisperSupportedLanguages.ts'),
];

/** The families that can draw every letter of `text`. */
function familiesDrawing(text: string): string[] {
  const letters = [...text].filter((character) => /\p{Letter}|\p{Mark}/u.test(character));
  if (letters.length === 0) return [];
  return [...coverageByFamily]
    .filter(([, covered]) => letters.every((letter) => covered.has(letter.codePointAt(0)!)))
    .map(([family]) => family);
}

const scripts = new Map<string, { languages: Set<string>; families: string[] }>();

for (const { nameEn, nativeName } of languages) {
  const letter = [...nativeName].find((character) => /\p{Letter}/u.test(character));
  if (!letter) continue;
  const script = scriptOf(letter);
  const entry = scripts.get(script) ?? { languages: new Set<string>(), families: familiesDrawing(nativeName) };
  entry.languages.add(nameEn);
  scripts.set(script, entry);
}

const missing = [...scripts].filter(([, entry]) => entry.families.length === 0);
const unreachable = [...scripts].filter(([script, entry]) =>
  entry.families.length > 0 && !MANAGED_SCRIPT_NAMES.has(script) && entry.families.length < coverageByFamily.size);

console.log(`${coverageByFamily.size} families registered, ${languages.length} languages offered\n`);

console.log(`NO FACE AT ALL — needs a font (${missing.length} scripts)\n`);
for (const [script, entry] of missing.sort((a, b) => b[1].languages.size - a[1].languages.size)) {
  console.log(`  ${script.padEnd(12)} ${String(entry.languages.size).padStart(2)}  ${[...entry.languages].sort().join(', ')}`);
}

console.log(`\nHAS A FACE, NOT REACHABLE FROM EVERY TEMPLATE — needs catalogue wiring (${unreachable.length} scripts)\n`);
for (const [script, entry] of unreachable.sort((a, b) => b[1].languages.size - a[1].languages.size)) {
  console.log(`  ${script.padEnd(12)} ${String(entry.languages.size).padStart(2)} languages, ${entry.families.length}/${coverageByFamily.size} families`);
  console.log(`  ${' '.repeat(12)}    drawn by: ${entry.families.slice(0, 6).join(', ')}${entry.families.length > 6 ? ', ...' : ''}`);
}
