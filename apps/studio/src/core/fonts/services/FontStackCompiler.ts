import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import { FontMetrics } from '@core/fonts/domain/FontMetrics';
import type { FontMetricsReader } from '@core/fonts/domain/FontMetricsReader';
import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FONT_SCRIPT_RANGES } from '@core/fonts/domain/FontScriptRanges';
import type { FontStack } from '@core/fonts/domain/FontStack';
import { UnicodeRangeSet } from '@core/fonts/domain/UnicodeRangeSet';
import type { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import type { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import type { FontFaceCssWriter } from '@core/fonts/services/FontFaceCssWriter';
import type { FontStyleCompleter } from '@core/fonts/services/FontStyleCompleter';
import type { FontWeightUnifier } from '@core/fonts/services/FontWeightUnifier';
import type { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

export interface FontStackCompilationRequest {
  readonly stack: FontStack;
  /** Which alphabets the text this stack draws is written in. */
  readonly scripts: CaptionScripts;
  /** Code points to keep subsets for, or `null` to keep every subset the faces declare. */
  readonly usedCodepoints: ReadonlySet<number> | null;
}

/** A stack as CSS: one family name, the rules that give it its faces, and the faces they carry. */
export interface CompiledFontStack {
  readonly family: string;
  readonly css: string;
  readonly faces: ReadonlyArray<string>;
}

/** One face of a stack and the rules the page registers it through. */
interface RegisteredFace {
  readonly family: string;
  readonly declarations: ReadonlyArray<FontFaceDeclaration>;
}

/** Builds a composite family with explicit script coverage and shared vertical metrics. */
export class FontStackCompiler {

  constructor(
    private readonly faceResolver: DrawableFamilyResolver,
    private readonly namer: CompiledFamilyNamer,
    private readonly faceReader: FontFaceCssReader,
    private readonly metricsReader: FontMetricsReader,
    private readonly rangeParser: UnicodeRangeParser,
    private readonly cssWriter: FontFaceCssWriter,
    private readonly weightUnifier: FontWeightUnifier,
    private readonly styleCompleter: FontStyleCompleter,
  ) {}

  compile(request: FontStackCompilationRequest): CompiledFontStack {
    // Named from every face the stack draws with, registered or not, so
    // the name answers the request alone and cannot drift between a
    // preview and a render that registered a different set.
    const chosen = this.faceResolver.resolve(request.stack, request.scripts);
    const family = this.namer.nameFor(this.faceResolver.identity(request.stack, request.scripts));
    const faces = this.registeredFaces(chosen);
    const metrics = this.sharedMetrics(faces);
    const rules = this.rulesFor(faces, family, metrics, request);
    return {
      family,
      css: rules.map((rule) => this.cssWriter.write(rule)).join('\n'),
      faces: faces.map((face) => face.family),
    };
  }

  /**
   * The rules each face contributes, in the faces' own order. A face the
   * page registers nothing for is absent: a family name that resolves to
   * no rule contributes neither coverage nor metrics.
   */
  private registeredFaces(faces: ReadonlyArray<string>): RegisteredFace[] {
    const byFamily = new Map<string, FontFaceDeclaration[]>();
    for (const declaration of this.faceReader.read(new Set(faces))) {
      const registered = byFamily.get(declaration.family) ?? [];
      registered.push(declaration);
      byFamily.set(declaration.family, registered);
    }
    return faces
      .map((family) => ({ family, declarations: byFamily.get(family) ?? [] }))
      .filter((face) => face.declarations.length > 0);
  }

  /**
   * The box that holds every face, or `null` when one of them cannot be
   * measured yet — a face still loading, whose box would otherwise be
   * read off whatever the device stood in for it.
   */
  private sharedMetrics(faces: ReadonlyArray<RegisteredFace>): FontMetrics | null {
    let merged: FontMetrics | null = null;
    for (const face of faces) {
      const metrics = this.metricsReader.read(face.family);
      if (metrics === null) return null;
      merged = merged === null ? metrics : merged.mergedWith(metrics);
    }
    return merged;
  }

  private rulesFor(
    faces: ReadonlyArray<RegisteredFace>,
    family: string,
    metrics: FontMetrics | null,
    request: FontStackCompilationRequest,
  ): FontFaceDeclaration[] {
    const coverage = this.coverageFor(request);
    const written = this.levelled(faces);
    const rules: FontFaceDeclaration[] = [];
    for (const face of faces) {
      const allowed = coverage.get(face.family)!;
      for (const declaration of written.get(face.family)!) {
        const range = this.rangeOf(declaration).intersect(allowed);
        if (range.isEmpty()) continue;
        if (request.usedCodepoints !== null && !range.intersectsAny(request.usedCodepoints)) continue;
        rules.push({ ...declaration, family, unicodeRange: range.toCssValue(), metrics });
      }
    }
    return rules;
  }

  /**
   * The faces as the family declares them: one weight each, and a
   * declaration for every style, so that no request the browser settles
   * before it reads coverage can take a face out of the family.
   */
  private levelled(faces: ReadonlyArray<RegisteredFace>): Map<string, FontFaceDeclaration[]> {
    const byFace = new Map(faces.map((face) => [face.family, face.declarations]));
    return this.styleCompleter.complete(this.weightUnifier.unify(byFace));
  }

  /**
   * Script extensions may share marks. Fixed script order resolves those overlaps.
   * Characters without a supported script (spaces, punctuation, symbols) belong
   * to the first active face: Latin when present, otherwise the first active script.
   */
  private coverageFor(request: FontStackCompilationRequest): Map<string, UnicodeRangeSet> {
    const assignments = this.faceResolver.assignments(request.stack, request.scripts);
    const scripted = Object.values(FONT_SCRIPT_RANGES).reduce((sum, range) => sum.union(range), new UnicodeRangeSet([]));
    const otherLetters = new UnicodeRangeSet(
      [...request.scripts.otherLetterCodepoints].map((point) => [point, point] as const),
    );
    const common = UnicodeRangeSet.full().subtract(scripted).subtract(otherLetters);
    const coverage = new Map<string, UnicodeRangeSet>();
    let claimed = new UnicodeRangeSet([]);
    for (const [index, { script, family }] of assignments.entries()) {
      const scriptRange = FONT_SCRIPT_RANGES[script === 'urdu' ? 'arabic' : script];
      const range = (index === 0 ? scriptRange.union(common) : scriptRange).subtract(claimed);
      coverage.set(family, (coverage.get(family) ?? new UnicodeRangeSet([])).union(range));
      claimed = claimed.union(range);
    }
    return coverage;
  }

  private rangeOf(declaration: FontFaceDeclaration): UnicodeRangeSet {
    return this.rangeParser.parse(declaration.unicodeRange);
  }
}
