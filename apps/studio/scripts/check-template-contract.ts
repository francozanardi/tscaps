import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateContractValidatorFactory } from '@core/templates/services/contract/TemplateContractValidatorFactory';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import type { TemplateContractValidator } from '@core/templates/services/contract/TemplateContractValidator';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

// Mirrors the accepted extensions of the shared asset pool (see
// templates/AUTHORING.md §1).
const ASSET_EXTENSIONS = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const FILTER_ID_PATTERN = /<filter\b[^>]*\bid\s*=\s*["']([^"']+)["']/g;
const WIRING_NAMES_PATTERN = /function builtinTemplateNames\(\): string\[\] \{[\s\S]*?return \[([\s\S]*?)\];/;
const QUOTED_NAME_PATTERN = /'([^']+)'/g;

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const templatesDir = join(repoRoot, 'templates');
const wiringPath = join(repoRoot, 'apps/studio/src/bootstrap/wiring/templates.ts');

function listTemplateFolders(): string[] {
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
}

function listAssetIds(): Set<string> {
  const assetsDir = join(templatesDir, '_assets');
  if (!existsSync(assetsDir)) return new Set();
  return new Set(
    readdirSync(assetsDir)
      .filter((file) => ASSET_EXTENSIONS.has(extname(file).toLowerCase()))
      .map((file) => file.slice(0, -extname(file).length)),
  );
}

function extractFilterIds(filtersSvg: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const match of filtersSvg.matchAll(FILTER_ID_PATTERN)) ids.add(match[1]!);
  return ids;
}

function buildContext(
  templateJson: unknown,
  declaredControls: unknown,
  filtersSvg: string,
  declaredAnimations: unknown,
  fontStackIds: readonly string[],
): TemplateContractContext {
  const record =
    templateJson !== null && typeof templateJson === 'object'
      ? (templateJson as { styleControls?: ReadonlyArray<{ id?: unknown }> })
      : {};
  const handDeclaredControlIds = controlIdsOf(record.styleControls);
  const stylesheetDeclaredControlIds = controlIdsOf(declaredControls);
  return {
    styleControlIds: [...handDeclaredControlIds, ...stylesheetDeclaredControlIds],
    fontStackIds,
    handDeclaredControlIds,
    stylesheetDeclaredControlIds,
    filterIds: extractFilterIds(filtersSvg),
    declaredAnimationKeyframes: keyframeNamesOf(declaredAnimations),
  };
}

/** The `@keyframes` blocks the stylesheet's declared animations claim. */
function keyframeNamesOf(declaredAnimations: unknown): ReadonlySet<string> {
  const names = new Set<string>();
  if (!Array.isArray(declaredAnimations)) return names;
  for (const animation of declaredAnimations as ReadonlyArray<{ keyframes?: unknown }>) {
    if (!Array.isArray(animation.keyframes)) continue;
    for (const name of animation.keyframes as unknown[]) {
      if (typeof name === 'string') names.add(name);
    }
  }
  return names;
}

function controlIdsOf(controls: unknown): string[] {
  if (!Array.isArray(controls)) return [];
  return (controls as ReadonlyArray<{ id?: unknown }>)
    .map((control) => control.id)
    .filter((id): id is string => typeof id === 'string');
}

function validateTemplate(validator: TemplateContractValidator, name: string): ContractViolation[] {
  const dir = join(templatesDir, name);
  // Validate the built CSS: it's what the runtime reads and it holds
  // every `var(--tscaps-*)` reference resolved through the expander.
  // Requires `pnpm --filter @tscaps/studio-close templates:build` to
  // have run first (postinstall + explicit CI step both cover this).
  const builtCssPath = join(dir, 'style.build.css');
  if (!existsSync(builtCssPath)) {
    return [{ message: `${name}/style.build.css missing; run \`pnpm --filter @tscaps/studio-close templates:build\`.` }];
  }
  const css = readFileSync(builtCssPath, 'utf8');
  // Same reasoning for the filters: the built artifact is what the
  // runtime parses, and only there have recipe calls become the
  // primitives whose `var()` references this checks.
  const authoredFiltersPath = join(dir, 'filters.svg');
  const builtFiltersPath = join(dir, 'filters.build.svg');
  if (existsSync(authoredFiltersPath) && !existsSync(builtFiltersPath)) {
    return [{ message: `${name}/filters.build.svg missing; run \`pnpm --filter @tscaps/studio-close templates:build\`.` }];
  }
  const filtersSvg = existsSync(builtFiltersPath) ? readFileSync(builtFiltersPath, 'utf8') : '';
  const templateJson: unknown = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8'));
  // Controls a stylesheet declares while compiling reach the runtime
  // the same way the hand-written ones do, so the contract has to see
  // both or it would report a template for reading its own control.
  const controlsPath = join(dir, 'controls.build.json');
  const declaredControls: unknown = existsSync(controlsPath)
    ? JSON.parse(readFileSync(controlsPath, 'utf8'))
    : [];
  // The animations a stylesheet declares while compiling are what says
  // this template moves anything at all, so the contract has to see
  // them or it could not tell an undeclared animation from none.
  const animationsPath = join(dir, 'animations.build.json');
  const declaredAnimations: unknown = existsSync(animationsPath)
    ? JSON.parse(readFileSync(animationsPath, 'utf8'))
    : [];
  const fontsPath = join(dir, 'fonts.build.json');
  const fontStackIds: readonly string[] = existsSync(fontsPath) ? JSON.parse(readFileSync(fontsPath, 'utf8')) : [];
  const context = buildContext(templateJson, declaredControls, filtersSvg, declaredAnimations, fontStackIds);
  return [
    ...validator.validateTemplateJson(templateJson, context),
    ...validator.validateCss(css, context),
    ...(filtersSvg === '' ? [] : validator.validateFiltersSvg(filtersSvg, context)),
  ];
}

/**
 * Template folders must appear in the wiring's builtin list and
 * vice versa — a folder without an entry never reaches the gallery,
 * an entry without a folder breaks the build.
 */
function checkWiringRegistration(folders: ReadonlyArray<string>): string[] {
  const source = readFileSync(wiringPath, 'utf8');
  const listMatch = source.match(WIRING_NAMES_PATTERN);
  if (!listMatch) {
    return [`Could not locate builtinTemplateNames() in ${wiringPath}; update this script's pattern.`];
  }
  const registered = new Set<string>();
  for (const match of listMatch[1]!.matchAll(QUOTED_NAME_PATTERN)) registered.add(match[1]!);
  const problems: string[] = [];
  for (const folder of folders) {
    if (!registered.has(folder)) problems.push(`Template folder "${folder}" is not registered in builtinTemplateNames().`);
  }
  for (const name of registered) {
    if (!folders.includes(name)) problems.push(`builtinTemplateNames() lists "${name}" but templates/${name}/ does not exist.`);
  }
  return problems;
}

function main(): void {
  const folders = listTemplateFolders();
  const assetIds = listAssetIds();
  const catalog = new StyleControlCatalog(new SimilarNameFinder());
  const validator = new TemplateContractValidatorFactory(catalog).create({ has: (id) => assetIds.has(id) });

  let violationCount = 0;
  let dirtyTemplates = 0;
  for (const name of folders) {
    const violations = validateTemplate(validator, name);
    if (violations.length === 0) continue;
    dirtyTemplates++;
    violationCount += violations.length;
    console.error(`✗ ${name}`);
    for (const violation of violations) console.error(`  - ${violation.message}`);
  }

  const wiringProblems = checkWiringRegistration(folders);
  violationCount += wiringProblems.length;
  for (const problem of wiringProblems) console.error(`✗ wiring: ${problem}`);

  if (violationCount > 0) {
    console.error(`\n${violationCount} contract violation(s) across ${dirtyTemplates} template(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${folders.length} templates checked, contract clean.`);
}

main();
