import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { FontStackCssVarsBuilder } from '@core/fonts/services/FontStackCssVarsBuilder';
import { BidiJsAnalyzer, CssBlockSealer, CssFragmentParser, CssKeyframeNamespacer, CssMinifier, CursiveScriptDetector, HorizontalPlacementResolver, HorizontalSideResolver, SegmentPaddingCssRuleBuilder, SvgFilterDefinitionsParser, WordFragmenter } from '@tscaps/engine';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { BUILTIN_ANIMATION_FIELDS } from '@core/elements/infrastructure/BuiltinAnimationFields';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { TemplateContractValidatorFactory } from '@core/templates/services/contract/TemplateContractValidatorFactory';
import { RepositoryAssetReferenceIndex } from '@core/templates/services/contract/RepositoryAssetReferenceIndex';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import { TextDirectionCssVarBuilder } from '@core/sheets/services/TextDirectionCssVarBuilder';
import { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';
import { ControlValueCssRenderer } from '@core/templates/services/controls/ControlValueCssRenderer';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { DrawingFamilyFilter } from '@core/fonts/services/DrawingFamilyFilter';
import { CssFontFamilyReader } from '@core/fonts/services/CssFontFamilyReader';
import { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import { FontFaceCssWriter } from '@core/fonts/services/FontFaceCssWriter';
import { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';
import { CompiledFontFaceRegistrar } from '@core/fonts/services/CompiledFontFaceRegistrar';
import { FontStackCompiler } from '@core/fonts/services/FontStackCompiler';
import { FontStyleCompleter } from '@core/fonts/services/FontStyleCompleter';
import { FontWeightUnifier } from '@core/fonts/services/FontWeightUnifier';
import { ScriptFamilyResolver } from '@core/fonts/services/ScriptFamilyResolver';
import { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';
import { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';
import { ScriptRowResolver } from '@core/fonts/services/ScriptRowResolver';
import { ElementCaptionTextCollector } from '@core/elements/services/ElementCaptionTextCollector';
import { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import { SegmentFontStylesBuilder } from '@core/fonts/services/SegmentFontStylesBuilder';
import { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';
import { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';
import { EmojiCssVarBuilder } from '@core/effect/services/EmojiCssVarBuilder';
import { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontMetricsReader } from '@core/fonts/domain/FontMetricsReader';
import type { AssetLibraryModule } from '@bootstrap/wiring/asset-library';

export interface RenderingDependencies {
  readonly assetLibrary: AssetLibraryModule;
  /** Where the `@font-face` rules a stack compiles from are read. */
  readonly fontFaceCssReader: FontFaceCssReader;
  /** Where the box a face gives a line is measured. */
  readonly fontMetricsReader: FontMetricsReader;
}

export type RenderingModule = ReturnType<typeof bootRendering>;

/**
 * Rendering helpers shared by every surface that paints sheets — the
 * document deriver (editor), the export pipeline, and the live
 * preview. Holds the per-config var builders (typography, rotation,
 * style-values) and the composed `SheetCssVarsBuilder` consumers
 * inject.
 *
 * Depends on the asset library because `StyleValuesCssVarsBuilder`
 * resolves image-typed style controls through it. The composition
 * root wires the library against the user-blobs store before this
 * module boots.
 */
export function bootRendering(deps: RenderingDependencies) {
  const svgFilterDefinitionsParser = new SvgFilterDefinitionsParser();
  const horizontalSideResolver = new HorizontalSideResolver();
  const horizontalPlacementResolver = new HorizontalPlacementResolver(horizontalSideResolver);
  const fontScriptClassifier = new FontScriptClassifier();
  const captionTextCollector = new SheetCaptionTextCollector();
  const compiledFamilyNamer = new CompiledFamilyNamer();
  const drawableFamilyResolver = new DrawableFamilyResolver();
  const fontStackResolver = new FontStackResolver(compiledFamilyNamer, drawableFamilyResolver);
  const fontStackLibrary = new FontStackLibrary();
  const fontStackCssVarsBuilder = new FontStackCssVarsBuilder(fontStackLibrary, fontStackResolver);
  const scriptFamilyResolver = new ScriptFamilyResolver();
  const scriptRowResolver = new ScriptRowResolver(fontScriptClassifier);
  const typographyCssVarBuilder = new TypographyCssVarBuilder(horizontalSideResolver, fontStackResolver);
  const textDirectionCssVarBuilder = new TextDirectionCssVarBuilder();
  const rotationCssVarBuilder = new RotationCssVarBuilder();
  const styleValuesCssVarsBuilder = new StyleValuesCssVarsBuilder(
    deps.assetLibrary.repository,
    new ControlValueCssRenderer(fontStackResolver),
  );
  const segmentFontStylesBuilder = new SegmentFontStylesBuilder(fontStackResolver);
  const unicodeRangeParser = new UnicodeRangeParser();
  const fontFaceCssWriter = new FontFaceCssWriter(new FontFaceSourceTrimmer());
  const fontFaceCssBuilder = new FontFaceCssBuilder(deps.fontFaceCssReader, unicodeRangeParser, fontFaceCssWriter);
  const cssFontFamilyReader = new CssFontFamilyReader();
  const sheetFontFamilyCollector = new SheetFontFamilyCollector(
    drawableFamilyResolver,
    fontScriptClassifier,
    captionTextCollector,
    cssFontFamilyReader,
    new DrawingFamilyFilter(),
    fontStackLibrary,
  );
  const sheetFontFacesBuilder = new SheetFontFacesBuilder(
    sheetFontFamilyCollector,
    new FontStackCompiler(
      drawableFamilyResolver,
      compiledFamilyNamer,
      deps.fontFaceCssReader,
      deps.fontMetricsReader,
      unicodeRangeParser,
      fontFaceCssWriter,
      new FontWeightUnifier(),
      new FontStyleCompleter(),
    ),
    fontFaceCssBuilder,
  );
  const emojiCssVarBuilder = new EmojiCssVarBuilder();
  const cssBlockSealer = new CssBlockSealer();
  const animationCatalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
  const animationFieldCatalog = BUILTIN_ANIMATION_FIELDS;
  const controlCssWriter = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
  const animationCssBuilder = new ElementAnimationCssBuilder(
    animationCatalog,
    new ElementTimingVariableResolver(),
    controlCssWriter,
  );
  const layeredCaptionCssBuilder = new LayeredCaptionCssBuilder(
    new CssKeyframeNamespacer(),
    new CssMinifier(),
    cssBlockSealer,
  );
  return {
    animationCatalog,
    animationFieldCatalog,
    controlCssWriter,
    animationCssBuilder,
    animationCssWriter: new ElementAnimationCssWriter(animationCssBuilder),
    layeredCaptionCssBuilder,
    typographyCssVarBuilder,
    rotationCssVarBuilder,
    styleValuesCssVarsBuilder,
    emojiCssVarBuilder,
    sheetCssVarsBuilder: new SheetCssVarsBuilder(
      typographyCssVarBuilder,
      textDirectionCssVarBuilder,
      rotationCssVarBuilder,
      styleValuesCssVarsBuilder,
      emojiCssVarBuilder,
      fontStackCssVarsBuilder,
    ),
    horizontalSideResolver,
    horizontalPlacementResolver,
    fontStackResolver,
    fontStackCssVarsBuilder,
    compiledFamilyNamer,
    drawableFamilyResolver,
    fontFaceCssBuilder,
    sheetFontFamilyCollector,
    sheetFontFacesBuilder,
    compiledFontFaceRegistrar: new CompiledFontFaceRegistrar(sheetFontFacesBuilder),
    scriptFamilyResolver,
    scriptRowResolver,
    elementCaptionTextCollector: new ElementCaptionTextCollector(),
    fontScriptClassifier,
    captionTextCollector,
    segmentFontStylesBuilder,
    captionFontOverridesBuilder: new CaptionFontOverridesBuilder(segmentFontStylesBuilder),
    sheetScriptsSynchronizer: new SheetScriptsSynchronizer(fontScriptClassifier, captionTextCollector),
    segmentColorRotation: new SegmentColorRotation(),
    wordFragmenter: new WordFragmenter(new BidiJsAnalyzer(), new CursiveScriptDetector()),
    segmentPaddingCssRuleBuilder: new SegmentPaddingCssRuleBuilder(),
    svgFilterDefinitionsParser,
    svgFilterDefinitionsResolver: new SheetSvgFilterDefinitionsResolver(svgFilterDefinitionsParser),
    templateContractValidator: new TemplateContractValidatorFactory(
      new StyleControlCatalog(new SimilarNameFinder()),
    ).create(
      new RepositoryAssetReferenceIndex(deps.assetLibrary.repository),
    ),
  };
}
