import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { ControlField } from '@core/templates/domain/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { RenderingConfig } from '@core/templates/domain/RenderingConfig';
import type { FeaturesConfig } from '@core/templates/domain/FeaturesConfig';

export class DefaultTemplate implements Template {

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
    readonly svgFilterDefinitions: SvgFilterDefinitions,
    private readonly css: string,
    private readonly filtersSvg: string,
  ) { }

  getCss(): string {
    return this.css;
  }

  getFiltersSvg(): string {
    return this.filtersSvg;
  }
}
