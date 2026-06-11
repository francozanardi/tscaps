import { SvgFilterDefinitions, SvgFilterDefinitionsParser } from '@tscaps/engine';
import type { AlignmentConfig } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import { DefaultTemplate } from '@core/templates/infrastructure/DefaultTemplate';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { ControlField } from '@core/templates/domain/ControlField';
import type { RenderingConfig } from '@core/templates/domain/RenderingConfig';
import type { FeaturesConfig } from '@core/templates/domain/FeaturesConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { CssAssetReferenceResolver } from '@core/templates/services/CssAssetReferenceResolver';
import {
  TEMPLATE_RECORD_CURRENT_VERSION,
  type TemplateRecordMigrator,
} from '@core/templates/services/TemplateRecordMigrator';

export interface SerializedTemplate {
  readonly version: number;
  readonly metadata: TemplateMetadata;
  readonly typography: TypographyConfig;
  readonly rotation: RotationConfig;
  readonly alignment: AlignmentConfig;
  readonly rendering: RenderingConfig;
  readonly features: FeaturesConfig;
  readonly effectConfigs: readonly EffectConfig[];
  readonly segmentSplitterConfigs: readonly SegmentSplitterConfig[];
  readonly lineSplitter: LineSplitterConfig;
  readonly styleControls: readonly ControlField[];
  readonly css: string;
  readonly filtersSvg: string | null;
}

/**
 * Converts a `Template` to and from a JSON-serialisable record so any
 * persistence layer can store it without knowing the runtime class.
 * `deserialize` is the inverse of `serialize` for any template whose
 * fields are JSON-safe.
 *
 * Css and filters.svg are re-run through the asset reference resolver
 * on deserialise to defensively normalise any `asset:<id>` token left
 * in a saved override; a payload with no tokens passes through
 * unchanged.
 */
export class TemplateSerializer {

  constructor(
    private readonly cssAssetReferenceResolver: CssAssetReferenceResolver,
    private readonly svgFilterDefinitionsParser: SvgFilterDefinitionsParser,
    private readonly migrator: TemplateRecordMigrator,
  ) {}

  serialize(template: Template): SerializedTemplate {
    return {
      version: TEMPLATE_RECORD_CURRENT_VERSION,
      metadata: template.metadata,
      typography: template.typography,
      rotation: template.rotation,
      alignment: template.alignment,
      rendering: template.rendering,
      features: template.features,
      effectConfigs: template.effectConfigs,
      segmentSplitterConfigs: template.segmentSplitterConfigs,
      lineSplitter: template.lineSplitter,
      styleControls: template.styleControls,
      css: template.getCss(),
      filtersSvg: this.normaliseFiltersSvg(template.getFiltersSvg()),
    };
  }

  /**
   * Accepts `unknown` because stored payloads may originate from
   * older schema versions: storage trusts whatever was written but
   * reads happen across app upgrades. The migrator brings the record
   * up to `TEMPLATE_RECORD_CURRENT_VERSION` before any field is read
   * off it.
   */
  deserialize(data: unknown): Template {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Template payload is not an object.');
    }
    const migrated = this.migrator.migrate(
      data as Record<string, unknown>,
      TEMPLATE_RECORD_CURRENT_VERSION,
    ) as unknown as SerializedTemplate;
    const filtersSvg = migrated.filtersSvg ?? '';
    return new DefaultTemplate(
      migrated.metadata,
      migrated.typography,
      migrated.rotation,
      migrated.alignment,
      migrated.rendering,
      migrated.features,
      migrated.effectConfigs,
      migrated.segmentSplitterConfigs,
      migrated.lineSplitter,
      migrated.styleControls,
      filtersSvg ? this.svgFilterDefinitionsParser.parse(filtersSvg) : SvgFilterDefinitions.empty(),
      this.cssAssetReferenceResolver.resolve(migrated.css),
      filtersSvg ? this.cssAssetReferenceResolver.resolve(filtersSvg) : '',
    );
  }

  private normaliseFiltersSvg(filtersSvg: string): string | null {
    return filtersSvg === '' ? null : filtersSvg;
  }
}
