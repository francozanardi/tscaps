import type { TemplateAssets } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import type { JsonTemplateSchema } from '@core/templates/domain/definition/JsonTemplateSchema';

/**
 * Assembles the `TemplateAssets` registry from raw module maps produced by
 * Vite's `import.meta.glob` over the repo-root `templates/<name>/`
 * directories. Each template contributes a `style.css`, a `template.json`,
 * and optionally a `filters.svg`. Binary visual assets live in a separate
 * pool (`templates/_assets/`) and are not template-scoped — see
 * `AssetCatalog`.
 */
export class BuiltinTemplateAssetsBuilder {

  constructor(
    private readonly cssModules: Record<string, string>,
    private readonly configModules: Record<string, unknown>,
    private readonly filterModules: Record<string, string> = {},
  ) {}

  build(): TemplateAssets {
    const filtersByTemplate = this.groupFiltersByTemplate();
    const result: TemplateAssets = {};
    for (const [path, css] of Object.entries(this.cssModules)) {
      const name = this.templateNameFromPath(path);
      const filtersSvg = filtersByTemplate.get(name);
      const entry: TemplateAssets[string] = { css, config: this.configFor(name) };
      if (filtersSvg !== undefined) entry.filtersSvg = filtersSvg;
      result[name] = entry;
    }
    return result;
  }

  private configFor(templateName: string): JsonTemplateSchema {
    const entry = Object.entries(this.configModules).find(
      ([path]) => this.templateNameFromPath(path) === templateName,
    );
    if (entry === undefined) {
      throw new Error(`Missing template.json for builtin template "${templateName}"`);
    }
    return entry[1] as JsonTemplateSchema;
  }

  private groupFiltersByTemplate(): Map<string, string> {
    const grouped = new Map<string, string>();
    for (const [path, source] of Object.entries(this.filterModules)) {
      grouped.set(this.templateNameFromPath(path), source);
    }
    return grouped;
  }

  // `.../templates/brush/style.css` → `brush`
  private templateNameFromPath(path: string): string {
    const segments = path.split('/');
    const idx = segments.lastIndexOf('templates');
    const name = idx >= 0 ? segments[idx + 1] : undefined;
    if (name === undefined) {
      throw new Error(`Unexpected template path: "${path}"`);
    }
    return name;
  }
}
