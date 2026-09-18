import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v18 → v19: replaces the one family a sheet or an element was set in
 * with a full stack — a face per writing system.
 *
 * A template's font controls are left alone: nothing in a stored
 * payload says which of them held a font, and the id is the template
 * author's to choose. They are opened where the template's own fields
 * are at hand to answer it, on the way out of storage.
 *
 * An element's declaration is rewritten alongside its record, so a
 * migrated field opens on the stack it was left at rather than
 * reporting itself overruled by CSS it wrote itself.
 */
export class ProjectV18ToV19Migration implements ProjectMigration {
  readonly fromVersion = 18;

  constructor(
    private readonly catalog: StyledElementCatalog,
    private readonly cssWriter: ElementControlCssWriter,
    private readonly fontStackReader: StoredFontStackReader,
  ) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return {
      ...data,
      ...(Array.isArray(data.sheets) ? { sheets: data.sheets.map((sheet) => this.migrateSheet(sheet)) } : {}),
      elementStyles: this.migrateElementStyles(data.elementStyles),
    };
  }

  private migrateSheet(sheet: unknown): unknown {
    if (!this.isRecord(sheet)) return sheet;
    return {
      ...sheet,
      ...(this.isRecord(sheet.typographyConfig)
        ? { typographyConfig: this.fontStackReader.readTypography(sheet.typographyConfig) }
        : {}),
    };
  }

  private migrateElementStyles(stored: unknown): Record<string, unknown> {
    let styles = ElementStyles.fromSnapshot((stored ?? {}) as never);
    for (const [id, style] of [...styles.all()]) {
      const family = style.fields?.[ElementFieldId.FONT_FAMILY];
      if (typeof family !== 'string') continue;
      const control = this.catalog.controlFor(style.kind, ElementFieldId.FONT_FAMILY);
      if (!control) continue;
      const faces = this.fontStackReader.facesLedBy(family);
      const css = this.cssWriter.write(style.css, control, faces);
      styles = styles.withField(id, style.kind, control.id, faces, css);
    }
    return styles.toSnapshot();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
