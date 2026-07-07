import { SegmentPaddingCssRuleBuilder, SvgFilterDefinitionsParser } from '@tscaps/engine';
import { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';
import { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import { EmojiCssVarBuilder } from '@core/effect/services/EmojiCssVarBuilder';
import { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { AssetLibraryModule } from '@bootstrap/wiring/asset-library';

export interface RenderingDependencies {
  readonly assetLibrary: AssetLibraryModule;
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
  const typographyCssVarBuilder = new TypographyCssVarBuilder();
  const rotationCssVarBuilder = new RotationCssVarBuilder();
  const styleValuesCssVarsBuilder = new StyleValuesCssVarsBuilder(deps.assetLibrary.repository);
  const emojiCssVarBuilder = new EmojiCssVarBuilder();
  return {
    typographyCssVarBuilder,
    rotationCssVarBuilder,
    styleValuesCssVarsBuilder,
    emojiCssVarBuilder,
    sheetCssVarsBuilder: new SheetCssVarsBuilder(
      typographyCssVarBuilder,
      rotationCssVarBuilder,
      styleValuesCssVarsBuilder,
      emojiCssVarBuilder,
    ),
    segmentColorRotation: new SegmentColorRotation(),
    segmentPaddingCssRuleBuilder: new SegmentPaddingCssRuleBuilder(),
    svgFilterDefinitionsParser,
    svgFilterDefinitionsResolver: new SheetSvgFilterDefinitionsResolver(svgFilterDefinitionsParser),
  };
}
