import type { AlignmentConfig } from '@tscaps/engine';
import { SvgFilterDefinitions, SvgFilterDefinitionsParser, TagConditionParser } from '@tscaps/engine';
import type { JsonTemplateSchema, JsonRenderingConfig, JsonFeaturesConfig, JsonBehindActorTemplateConfig, JsonTypographyConfig, EffectConfigOverride, SegmentSplitterEntry } from '@core/templates/domain/definition/JsonTemplateSchema';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import type { StyleControlResolver } from '@core/templates/services/controls/StyleControlResolver';
import TemplateLoader from '@core/templates/domain/TemplateLoader';
import { Template } from '@core/templates/domain/Template';
import { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { TEMPLATE_CATEGORIES, type TemplateCategory } from '@core/templates/domain/TemplateCategory';
import { DECLARABLE_BROWSERS, type DeclarableBrowser } from '@core/browser-support/domain/DeclarableBrowser';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { AnimationSupport, FeaturesConfig, RotationSupport } from '@core/templates/domain/definition/FeaturesConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { BoxEdgesShorthandParser } from '@core/templates/services/BoxEdgesShorthandParser';
import { CssAssetReferenceResolver } from '@core/templates/services/CssAssetReferenceResolver';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import type { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import type { EffectRegistry } from '@core/effect/services/EffectRegistry';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { DEFAULT_FONT_STACK_ID } from '@core/fonts/domain/FontStackCatalog';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

export type TemplateAssets = Record<string, {
  css: string;
  config: JsonTemplateSchema;
  /** Raw `filters.svg` contents when the template ships one. */
  filtersSvg?: string;
  /**
   * Controls the stylesheet declared for itself while compiling, by
   * using a primitive that reads one. They are the template's controls
   * as much as the hand-written ones — only their declaration lives at
   * the point of use instead of in `template.json`.
   */
  declaredControls?: readonly ControlField[];
  /**
   * The library animations the stylesheet applied while compiling, each
   * with the clock it runs on. What the template moves, as opposed to
   * what it looks like — absent for a template that moves nothing, or
   * that moves on keyframes of its own.
   */
  declaredAnimations?: readonly DeclaredAnimation[];
  /** Fixed catalog stacks recorded while compiling the stylesheet. */
  fontStackIds?: readonly string[];
}>;

const ALIGNMENT_DEFAULT: AlignmentConfig = { verticalAlign: 'top', verticalOffset: 0.75, horizontalAlign: 'center', horizontalOffset: 0.5 };
const RENDERING_DEFAULT: RenderingConfig = {
  splitWordsIntoLetters: false,
  videoFrame: { required: false, jpegQuality: 0.7, previewMode: 'omit' },
  padding: null,
};
const FEATURES_DEFAULT: FeaturesConfig = {
  rotation: { segment: true, word: true },
  animation: { segment: true, line: true, word: true, decoration: true },
  behindActorOverride: true,
};
const CATEGORY_DEFAULT: TemplateCategory = 'lab';
const SEGMENT_SPLITTERS_DEFAULT: SegmentSplitterEntry[] = [
  { type: 'boundary' },
  { type: 'limit_by_chars' },
];

// Speaker-change splitting is a product-level feature that applies to every
// template regardless of its declared pipeline. Templates may still override
// the entry (e.g. `{ type: 'speaker_change', enabled: false }`) or reposition
// it by listing it explicitly; otherwise it is prepended with defaults so the
// editor always exposes its control.
const MANDATORY_SEGMENT_SPLITTER: SegmentSplitterConfig['type'] = 'speaker_change';

// Universal typography vars that every template's CSS is expected to
// read via `var(<name>, <fallback>)` so the global controls take
// effect. Rotation vars are intentionally excluded — they are opt-in
// per template (see `detectRotationSupport`), and `HIGHLIGHT_COLOR`
// is a per-template styleControl. `TEXT_DIRECTION` is excluded too:
// only a template whose design points at a side has anything to mirror,
// and it reads the value through a style query rather than `var(`.
const REQUIRED_UNIVERSAL_CSS_VARS: ReadonlyArray<TemplateCssVariable> = [
  TemplateCssVariable.FONT_FAMILY,
  TemplateCssVariable.FONT_SIZE,
  TemplateCssVariable.FONT_WEIGHT,
  TemplateCssVariable.FONT_STYLE,
  TemplateCssVariable.LETTER_SPACING,
  TemplateCssVariable.WORD_SPACING,
  TemplateCssVariable.LINE_SPACING,
  TemplateCssVariable.TEXT_ALIGN,
  TemplateCssVariable.TEXT_TRANSFORM,
  TemplateCssVariable.TEXT_DECORATION,
];

export class LocalFileTemplateLoader implements TemplateLoader {

  constructor(
    private readonly assets: TemplateAssets,
    private readonly cssAssetReferenceResolver: CssAssetReferenceResolver,
    private readonly segmentSplitters: SegmentSplitterRegistry,
    private readonly lineSplitters: LineSplitterRegistry,
    private readonly effects: EffectRegistry,
    private readonly svgFilterDefinitionsParser: SvgFilterDefinitionsParser,
    private readonly boxEdgesShorthandParser: BoxEdgesShorthandParser,
    private readonly tagConditionParser: TagConditionParser,
    private readonly styleControlResolver: StyleControlResolver,
    private readonly fontStackLibrary: FontStackLibrary,
  ) {}

  async load(name: string): Promise<Template> {
    const asset = this.assets[name];
    if (!asset) {
      throw new Error(`Unknown template: "${name}"`);
    }
    const { config } = asset;
    const rendering = this.loadRendering(config.rendering);
    const features = this.loadFeatures(config.features);
    const behindActor = this.loadBehindActor(config.behindActor);
    const css = this.cssAssetReferenceResolver.resolve(asset.css);
    this.warnOnMissingUniversalCssVars(name, css);
    return new Template(
      this.loadMetadata(name, config),
      this.loadTypography(config.typography),
      this.loadRotation(config.rotation),
      this.loadAlignment(config.alignment),
      rendering,
      features,
      behindActor,
      this.loadEffectConfigs(config.effects),
      this.loadSegmentSplitters(config.segmentSplitters),
      this.loadLineSplitter(config.lineSplitter),
      this.buildStyleControls(config, asset.declaredControls),
      config.variants ?? [],
      asset.filtersSvg
        ? this.svgFilterDefinitionsParser.parse(asset.filtersSvg)
        : SvgFilterDefinitions.empty(),
      css,
      asset.filtersSvg ?? '',
      asset.declaredAnimations ?? [],
      asset.fontStackIds ?? [],
    );
  }

  /**
   * Assembles the template's `ControlField` list from the two sources
   * that declare controls — `styleControls` in `template.json` and the
   * primitives the stylesheet uses — running each hand-declared entry
   * through the resolver so a catalogued id needs only its default.
   */
  private buildStyleControls(
    config: JsonTemplateSchema,
    declaredByStylesheet: readonly ControlField[] | undefined,
  ): ControlField[] {
    const handDeclared = (config.styleControls ?? []).map((entry) => this.styleControlResolver.resolve(entry));
    return [...handDeclared, ...(declaredByStylesheet ?? [])];
  }

  private loadRendering(config: JsonRenderingConfig | undefined): RenderingConfig {
    const splitWordsIntoLetters = config?.splitWordsIntoLetters ?? RENDERING_DEFAULT.splitWordsIntoLetters;
    const videoFrame = {
      ...RENDERING_DEFAULT.videoFrame,
      ...config?.videoFrame,
      jpegQuality: this.resolveJpegQuality(config?.videoFrame?.jpegQuality),
    };
    const padding = config?.padding ? this.boxEdgesShorthandParser.parse(config.padding) : null;
    return { splitWordsIntoLetters, videoFrame, padding };
  }

  /**
   * Falls back to the default for anything that is not a number in `[0, 1]`.
   * The parameter is `unknown` because the value arrives from parsed JSON,
   * where the declared type guarantees nothing.
   *
   * Load-bearing because the canvas encode APIs disagree on how to read an
   * unusable quality: Chromium's `convertToBlob` treats a missing one as 1.0
   * while `toDataURL` applies its own ~0.92 default. Either way the frame
   * silently encodes far heavier than the template asked for, with no error.
   */
  private resolveJpegQuality(value: unknown): number {
    const isUsable = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    return isUsable ? value : RENDERING_DEFAULT.videoFrame.jpegQuality;
  }

  private loadBehindActor(config: JsonBehindActorTemplateConfig | undefined): BehindActorTemplateConfig {
    return {
      required: config?.required ?? BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT.required,
      tagCondition: config?.tagCondition
        ? this.tagConditionParser.parse(config.tagCondition)
        : null,
    };
  }

  /** Every feature flag defaults to `true`; the template author only
   *  declares an entry when the template does NOT support it. */
  private loadFeatures(config: JsonFeaturesConfig | undefined): FeaturesConfig {
    return {
      rotation: this.loadRotationSupport(config?.rotation),
      animation: this.loadAnimationSupport(config?.animation),
      behindActorOverride: config?.behindActorOverride ?? FEATURES_DEFAULT.behindActorOverride,
    };
  }

  private loadAnimationSupport(declared: JsonFeaturesConfig['animation']): AnimationSupport {
    const shipped = FEATURES_DEFAULT.animation;
    return {
      segment: declared?.segment ?? shipped.segment,
      line: declared?.line ?? shipped.line,
      word: declared?.word ?? shipped.word,
      decoration: declared?.decoration ?? shipped.decoration,
    };
  }

  private loadRotationSupport(declared: { segment?: boolean; word?: boolean } | undefined): RotationSupport {
    return {
      segment: declared?.segment ?? FEATURES_DEFAULT.rotation.segment,
      word: declared?.word ?? FEATURES_DEFAULT.rotation.word,
    };
  }

  private loadMetadata(name: string, config: JsonTemplateSchema): TemplateMetadata {
    return {
      id: name,
      name,
      category: this.resolveCategory(config.category),
      unsupportedBrowsers: this.resolveUnsupportedBrowsers(config.unsupportedBrowsers),
    };
  }

  /**
   * Drops slugs no browser answers to, so a typo restricts nothing
   * rather than restricting something unintended. The loud path is
   * `UnsupportedBrowsersTemplateJsonContractRule`, which refuses the
   * same slug at build time.
   */
  private resolveUnsupportedBrowsers(declared: string[] | undefined): readonly DeclarableBrowser[] {
    return (declared ?? []).filter((name): name is DeclarableBrowser => Object.hasOwn(DECLARABLE_BROWSERS, name));
  }

  private resolveCategory(declared: string | undefined): TemplateCategory {
    if (declared !== undefined && declared in TEMPLATE_CATEGORIES) return declared as TemplateCategory;
    return CATEGORY_DEFAULT;
  }

  private loadTypography(config?: JsonTypographyConfig): TypographyConfig {
    const { fontStack, ...rest } = config ?? {};
    return {
      ...TYPOGRAPHY_DEFAULTS,
      ...rest,
      fontStack: this.fontStackLibrary.stackFor(fontStack ?? DEFAULT_FONT_STACK_ID),
    };
  }

  private loadRotation(config?: Partial<RotationConfig>): RotationConfig {
    return { ...ROTATION_DEFAULTS, ...config };
  }

  private loadAlignment(config?: Partial<AlignmentConfig>): AlignmentConfig {
    return { ...ALIGNMENT_DEFAULT, ...config };
  }

  /**
   * Merges template-declared effect overrides onto the registry's defaults
   * so every known effect appears in the result, in registry order. The
   * template only needs to declare the effects whose defaults it wants to
   * change (typically: which effects start enabled); everything else
   * inherits the descriptor's default config.
   */
  private loadEffectConfigs(overrides?: EffectConfigOverride[]): EffectConfig[] {
    const overrideByType = new Map<string, EffectConfigOverride>();
    for (const o of overrides ?? []) overrideByType.set(o.type, o);
    return this.effects.list().map((descriptor) => {
      const override = overrideByType.get(descriptor.type);
      return { ...descriptor.defaultConfig, ...override } as EffectConfig;
    });
  }

  /**
   * Materializes the template's splitter pipeline. The template declares
   * an ordered list of entries; each entry's `type` is required and its
   * remaining fields are merged onto the descriptor's `defaultConfig`. If
   * the template omits the array entirely, the system default pipeline is
   * used (speaker-change, boundary on sentences, then limit-by-chars).
   */
  private loadSegmentSplitters(entries?: SegmentSplitterEntry[]): SegmentSplitterConfig[] {
    const declared = entries ?? SEGMENT_SPLITTERS_DEFAULT;
    const hasMandatory = declared.some((e) => e.type === MANDATORY_SEGMENT_SPLITTER);
    const resolved = hasMandatory ? declared : [{ type: MANDATORY_SEGMENT_SPLITTER }, ...declared];
    return resolved.map((entry) => {
      const descriptor = this.segmentSplitters.get(entry.type);
      return { ...descriptor.defaultConfig, ...entry } as SegmentSplitterConfig;
    });
  }

  private loadLineSplitter(config?: JsonTemplateSchema['lineSplitter']): LineSplitterConfig {
    const type: LineSplitterConfig['type'] = config?.type ?? 'balanced';
    const descriptor = this.lineSplitters.get(type);
    return { ...descriptor.defaultConfig, ...config, type } as LineSplitterConfig;
  }

  /**
   * Surfaces a one-time `console.warn` when a template's CSS doesn't read a
   * universal typography var. Each missing var means the corresponding
   * editor control (font-size slider, italic toggle, …) silently has no
   * effect on this template — almost always a template-author bug.
   *
   * The check is a substring scan for `var(<name>` rather than a CSS parse:
   * cheap, robust enough across whitespace/quote variants, and a template
   * intentionally hardcoding a property can satisfy it by mentioning the
   * var name inside a CSS comment next to its rule.
   */
  private warnOnMissingUniversalCssVars(name: string, css: string): void {
    const missing = REQUIRED_UNIVERSAL_CSS_VARS.filter((v) => !css.includes(`var(${v}`));
    if (missing.length === 0) return;
    console.warn(
      `[tscaps] Template "${name}" doesn't reference universal CSS variable(s): ${missing.join(', ')}. ` +
      `Add \`var(<name>, <fallback>)\` to its style.css so the corresponding editor controls take effect.`,
    );
  }
}
