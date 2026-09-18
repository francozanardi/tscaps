import { describe, expect, it } from 'vitest';
import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import { FontMetrics } from '@core/fonts/domain/FontMetrics';
import type { FontMetricsReader } from '@core/fonts/domain/FontMetricsReader';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { FontFaceCssWriter } from '@core/fonts/services/FontFaceCssWriter';
import { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';
import { FontStackCompiler } from '@core/fonts/services/FontStackCompiler';
import { FontStyleCompleter } from '@core/fonts/services/FontStyleCompleter';
import { FontWeightUnifier } from '@core/fonts/services/FontWeightUnifier';
import { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

class FullCoverageFaceReader implements FontFaceCssReader {
  read(families: ReadonlySet<string>): FontFaceDeclaration[] {
    return [...families].map((family) => ({
      family,
      source: `url(/${family}.woff2)`,
      unicodeRange: '',
      descriptors: new Map([['font-weight', '400']]),
      metrics: null,
    }));
  }
}

class FixedMetricsReader implements FontMetricsReader {
  read(): FontMetrics {
    return new FontMetrics(1, 0.25);
  }
}

const rangeParser = new UnicodeRangeParser();
const familyResolver = new DrawableFamilyResolver();
const compiler = new FontStackCompiler(
  familyResolver,
  new CompiledFamilyNamer(),
  new FullCoverageFaceReader(),
  new FixedMetricsReader(),
  rangeParser,
  new FontFaceCssWriter(new FontFaceSourceTrimmer()),
  new FontWeightUnifier(),
  new FontStyleCompleter(),
);

describe('compiled coverage beside an Other face', () => {
  it('leaves unsupported letters to the literal family even when a managed face contains them', () => {
    const scripts = new CaptionScripts('latin', new Set(['latin']), false, new Set([0x4E16]));
    const compiled = compiler.compile({
      stack: new FontStackLibrary().stackFor('inter'),
      scripts,
      usedCodepoints: null,
    });
    const range = /unicode-range:([^;}]+)/.exec(compiled.css)?.[1] ?? '';
    const coverage = rangeParser.parse(range);
    expect(coverage.intersectsAny([0x41])).toBe(true);
    expect(coverage.intersectsAny([0x20])).toBe(true);
    expect(coverage.intersectsAny([0x4E16])).toBe(false);
  });

  it('gives different compiled families to sheets that exclude different Other letters', () => {
    const stack = new FontStackLibrary().stackFor('inter');
    const japanese = new CaptionScripts('latin', new Set(['latin']), false, new Set([0x65E5]));
    const korean = new CaptionScripts('latin', new Set(['latin']), false, new Set([0xD55C]));
    expect(compiler.compile({ stack, scripts: japanese, usedCodepoints: null }).family)
      .not.toBe(compiler.compile({ stack, scripts: korean, usedCodepoints: null }).family);
  });
});
