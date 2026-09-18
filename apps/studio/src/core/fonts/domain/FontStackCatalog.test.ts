import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { create, type Font } from 'fontkitten';
import { beforeAll, describe, expect, it } from 'vitest';
import { FONT_STACKS } from '@core/fonts/domain/FontStackCatalog';
import { FONT_SCRIPTS, type FontScript } from '@core/fonts/domain/FontScript';
import { FONT_SCRIPT_RANGES } from '@core/fonts/domain/FontScriptRanges';
import { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

// A minimum modern repertoire, not all of Unicode Script_Extensions. Those ranges
// also contain historic letters, phonetic symbols and specialist marks. Expanding
// this contract is a deliberate coverage decision, never a threshold adjusted to
// make the current fonts pass. A cmap check verifies glyph availability, not shaping.
const REQUIRED_CHARACTERS: Readonly<Record<FontScript, string>> = {
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÜÑáéíóúüñ',
  cyrillic: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя',
  greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωάέήίόύώϊϋΐΰς',
  arabic: 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي',
  urdu: 'آابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنںوؤہھءیے',
  hebrew: 'אבגדהוזחטיךכלםמןנסעףפץצקרשת',
  devanagari: 'अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहािीुूृेैोौंःँ्',
  bengali: 'অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহািীুূৃেৈোৌংঃঁ্',
  telugu: 'అఆఇఈఉఊఋఎఏఐఒఓఔకఖగఘఙచఛజఝఞటఠడఢణతథదధనపఫబభమయరలవశషసహాిీుూృెేైొోౌంః్',
  tamil: 'அஆஇஈஉஊஎஏஐஒஓஔகஙசஞடணதநபமயரலவழளறனஜஷஸஹாிீுூெேைொோௌஂஃ்',
  thai: 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮะาิีึืุูเแโใไ็่้๊๋์',
};

/** Reads the bundled files once, merging subsets only within the same weight/style. */
class BundledFontCoverage {
  readonly families = new Map<string, Map<string, Set<number>>>();
  private readonly files = new Map<string, Font>();
  private readonly rangeParser = new UnicodeRangeParser();

  constructor() {
    const entry = resolve('src/styles/fonts.css');
    const css = readFileSync(entry, 'utf8');
    const require = createRequire(entry);
    this.readStylesheet(entry, css);
    for (const [, specifier] of css.matchAll(/@import\s+'([^']+)'/g)) {
      const file = require.resolve(specifier!.endsWith('.css') ? specifier! : `${specifier}/index.css`);
      this.readStylesheet(file, readFileSync(file, 'utf8'));
    }
  }

  private readStylesheet(file: string, css: string): void {
    for (const [, block] of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
      const declarations = new Map(block!.split(';').map((declaration) => {
        const separator = declaration.indexOf(':');
        return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()];
      }));
      const family = declarations.get('font-family')!.replace(/['"]/g, '');
      const source = /url\(['"]?([^)'"\s]+\.woff2)/.exec(declarations.get('src') ?? '')?.[1];
      if (!source) throw new Error(`No WOFF2 source for ${family} in ${file}`);
      const font = this.readFont(resolve(dirname(file), source));
      const range = this.rangeParser.parse(declarations.get('unicode-range') ?? '');
      const profile = `${declarations.get('font-weight') ?? 'normal'} / ${declarations.get('font-style') ?? 'normal'}`;
      const profiles = this.families.get(family) ?? new Map<string, Set<number>>();
      const covered = profiles.get(profile) ?? new Set<number>();
      for (const codepoint of font.characterSet) {
        if (font.hasGlyphForCodePoint(codepoint) && range.intersectsAny([codepoint])) covered.add(codepoint);
      }
      profiles.set(profile, covered);
      this.families.set(family, profiles);
    }
  }

  private readFont(file: string): Font {
    const cached = this.files.get(file);
    if (cached) return cached;
    const font = create(readFileSync(file));
    if (font.isCollection) throw new Error(`Expected a single font in ${file}`);
    this.files.set(file, font);
    return font;
  }
}

let coverage: BundledFontCoverage;
beforeAll(() => { coverage = new BundledFontCoverage(); });

describe('catalog stacks cover the minimum alphabet for every assigned script', () => {
  it.each(FONT_STACKS)('$id', ({ id, faces }) => {
    for (const script of FONT_SCRIPTS) {
      const family = faces[script];
      const profiles = coverage.families.get(family);
      expect(profiles?.size, `${id}: ${script} face ${family} must be registered`).toBeGreaterThan(0);
      for (const [profile, supported] of profiles!) {
        const missing = [...REQUIRED_CHARACTERS[script]].filter((character) => !supported.has(character.codePointAt(0)!));
        expect(missing, `${id}: ${family} (${profile}) is missing ${script} glyphs`).toEqual([]);
      }
    }
  });

  it.each(FONT_SCRIPTS)('the %s routing range includes the required alphabet', (script) => {
    const range = FONT_SCRIPT_RANGES[script === 'urdu' ? 'arabic' : script];
    const missing = [...REQUIRED_CHARACTERS[script]].filter((character) => !range.intersectsAny([character.codePointAt(0)!]));
    expect(missing).toEqual([]);
  });
});
