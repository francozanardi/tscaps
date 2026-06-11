import type { TemplateAssets } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import { BuiltinTemplateAssetsBuilder } from '@core/templates/infrastructure/BuiltinTemplateAssetsBuilder';

// Vite scans the repo-root `templates/<name>/` directories at build time.
// Each template is a folder of static files: `style.css`, `template.json`,
// and optionally a `filters.svg`. Binary visual assets are not bundled
// per-template — they live in `templates/_assets/` and are exposed through
// `BuiltinAssetCatalog`.
const cssModules = import.meta.glob('../../../../../../templates/*/style.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const configModules = import.meta.glob('../../../../../../templates/*/template.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

// `filters.svg` is loaded as raw markup so its `<filter>` defs can be
// inlined into the host SVG at render time.
const filterModules = import.meta.glob('../../../../../../templates/*/filters.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export const BUILTIN_TEMPLATE_ASSETS: TemplateAssets = new BuiltinTemplateAssetsBuilder(
  cssModules,
  configModules,
  filterModules,
).build();
