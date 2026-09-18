import type { TemplateAssets } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import type { JsonTemplateSchema } from '@core/templates/domain/definition/JsonTemplateSchema';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';

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
    private readonly declaredControlModules: Record<string, unknown> = {},
    private readonly declaredAnimationModules: Record<string, unknown> = {},
    private readonly fontStackModules: Record<string, unknown> = {},
  ) {}

  build(): TemplateAssets {
    const filtersByTemplate = this.keyedByTemplate<string>(this.filterModules);
    const controlsByTemplate = this.keyedByTemplate<readonly ControlField[]>(this.declaredControlModules);
    const animationsByTemplate = this.keyedByTemplate<readonly DeclaredAnimation[]>(this.declaredAnimationModules);
    const fontsByTemplate = this.keyedByTemplate<readonly string[]>(this.fontStackModules);
    const result: TemplateAssets = {};
    for (const [path, css] of Object.entries(this.cssModules)) {
      const name = this.templateNameFromPath(path);
      const filtersSvg = filtersByTemplate.get(name);
      const declaredControls = controlsByTemplate.get(name);
      const declaredAnimations = animationsByTemplate.get(name);
      const entry: TemplateAssets[string] = { css, config: this.configFor(name) };
      if (filtersSvg !== undefined) entry.filtersSvg = filtersSvg;
      if (declaredControls !== undefined) entry.declaredControls = declaredControls;
      if (declaredAnimations !== undefined) entry.declaredAnimations = declaredAnimations;
      const fontStackIds = fontsByTemplate.get(name);
      if (fontStackIds !== undefined) entry.fontStackIds = fontStackIds;
      result[name] = entry;
    }
    return result;
  }

  /** The templates a glob covers, each mapped to the one module it contributed. */
  private keyedByTemplate<T>(modules: Record<string, unknown>): Map<string, T> {
    const byTemplate = new Map<string, T>();
    for (const [path, module] of Object.entries(modules)) {
      byTemplate.set(this.templateNameFromPath(path), module as T);
    }
    return byTemplate;
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
