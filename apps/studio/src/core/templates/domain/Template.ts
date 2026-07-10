import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { StyleVariants } from '@core/templates/domain/definition/StyleVariant';

/**
 * A template carries configs (not splitter / effect instances) so the
 * editor can override individual fields per session. Splitter and effect
 * instances are constructed fresh from these configs in DocumentDeriver.
 */
export class Template {

  constructor(
    readonly metadata: TemplateMetadata,
    readonly typography: TypographyConfig,
    readonly rotation: RotationConfig,
    readonly alignment: AlignmentConfig,
    readonly rendering: RenderingConfig,
    readonly features: FeaturesConfig,
    readonly effectConfigs: readonly EffectConfig[],
    readonly segmentSplitterConfigs: readonly SegmentSplitterConfig[],
    readonly lineSplitter: LineSplitterConfig,
    readonly styleControls: readonly ControlField[],
    readonly variants: StyleVariants,
    readonly svgFilterDefinitions: SvgFilterDefinitions,
    private readonly css: string,
    private readonly filtersSvg: string,
  ) { }

  getCss(): string {
    return this.css;
  }

  /** Raw `filters.svg` source the template ships, or `''` if it has none. */
  getFiltersSvg(): string {
    return this.filtersSvg;
  }
}
