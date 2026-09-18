import type { TemplateAssets } from '@core/templates/infrastructure/LocalFileTemplateLoader';
import { BuiltinTemplateAssetsBuilder } from '@core/templates/infrastructure/BuiltinTemplateAssetsBuilder';

// Vite scans the repo-root `templates/<name>/` directories at build time.
// The runtime reads the `.build.*` artifacts produced by
// `pnpm --filter @tscaps/studio-close templates:build` from the authored
// `style.scss` and `filters.svg`. They are gitignored and regenerated on
// every install and before every deploy. Binary visual assets live in
// `templates/_assets/` and are exposed through `BuiltinAssetCatalog`.
const cssModules = import.meta.glob('../../../../../../templates/*/style.build.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const configModules = import.meta.glob('../../../../../../templates/*/template.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

// Loaded as raw markup so its `<filter>` defs can be inlined into the
// host SVG at render time. This is the expanded artifact — recipe calls
// in the authored `filters.svg` are already resolved to primitives.
const filterModules = import.meta.glob('../../../../../../templates/*/filters.build.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// Controls the stylesheet declared for itself at compile time, through
// a primitive that reads one. Generated alongside the CSS and merged
// with the hand-written `styleControls`.
const declaredControlModules = import.meta.glob('../../../../../../templates/*/controls.build.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

// The library animations the stylesheet applied while compiling, each
// with the clock it runs on. Generated alongside the CSS, and the only
// record of what a template moves that does not require reading it.
const declaredAnimationModules = import.meta.glob('../../../../../../templates/*/animations.build.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const fontStackModules = import.meta.glob('../../../../../../templates/*/fonts.build.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export const BUILTIN_TEMPLATE_ASSETS: TemplateAssets = new BuiltinTemplateAssetsBuilder(
  cssModules,
  configModules,
  filterModules,
  declaredControlModules,
  declaredAnimationModules,
  fontStackModules,
).build();
