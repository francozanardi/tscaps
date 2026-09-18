import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { StyleVariants } from '@core/templates/domain/definition/StyleVariant';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';

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
    readonly behindActor: BehindActorTemplateConfig,
    readonly effectConfigs: readonly EffectConfig[],
    readonly segmentSplitterConfigs: readonly SegmentSplitterConfig[],
    readonly lineSplitter: LineSplitterConfig,
    readonly styleControls: readonly ControlField[],
    readonly variants: StyleVariants,
    readonly svgFilterDefinitions: SvgFilterDefinitions,
    private readonly css: string,
    private readonly filtersSvg: string,
    readonly declaredAnimations: readonly DeclaredAnimation[],
    /** Fixed catalog dependencies declared by the stylesheet, independent of style controls. */
    readonly fontStackIds: readonly string[] = [],
  ) { }

  getCss(): string {
    return this.css;
  }

  /**
   * The slot in `variants` that a sheet's preferred variant index lands
   * on for this template. A sheet's index is a preference, not a
   * position: it outlives templates that ship fewer variants — or none —
   * so every read of `variants` by index goes through here. Wraps into
   * range; returns `0` when the template ships no variants at all, where
   * the sheet renders the template's bare defaults.
   */
  resolveVariantIndex(preferredIndex: number): number {
    const count = this.variants.length;
    if (count === 0) return 0;
    return ((preferredIndex % count) + count) % count;
  }

  /** Raw `filters.svg` source the template ships, or `''` if it has none. */
  getFiltersSvg(): string {
    return this.filtersSvg;
  }
}
