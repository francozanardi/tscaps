import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { TemplateAnimationRegistry } from '@core/templates/services/animations/TemplateAnimationRegistry';
import { TemplateStyleControlRegistry } from '@core/templates/services/controls/TemplateStyleControlRegistry';
import { SvgFilterRecipe } from '@core/templates/services/filter-recipes/SvgFilterRecipe';
import { SvgRecipeExpander } from '@core/templates/services/filter-recipes/SvgRecipeExpander';
import { CommentSyntaxFiltersSvgContractRule } from '@core/templates/services/contract/CommentSyntaxFiltersSvgContractRule';
import { buildAnimationPresets } from './build-animation-presets';
import { controlFieldFunction } from './control-field-function';
import { declaredAnimationFunction } from './declared-animation-function';
import { fontStackFunction } from './font-stack-function';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { TemplateFontStackRegistry } from '@core/templates/services/fonts/TemplateFontStackRegistry';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const templatesDir = join(repoRoot, 'templates');
const primitivesDir = join(templatesDir, '_lib');
const recipesDir = join(primitivesDir, 'filters/recipes');

const commentSyntaxRule = new CommentSyntaxFiltersSvgContractRule();
const controlCatalog = new StyleControlCatalog(new SimilarNameFinder());

function listSvgFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((entry) => extname(entry) === '.svg').sort();
}

/**
 * Reads an authored SVG source after checking the comments it is about
 * to lose. Comments never reach a built document, so an invalid one
 * would reach no parser and no contract check either, and the cost
 * would land entirely on whoever opens the source next.
 */
function readSvgSource(path: string): string {
  const source = readFileSync(path, 'utf8');
  const violations = commentSyntaxRule.check(source);
  if (violations.length > 0) {
    throw new Error(`${relative(templatesDir, path)}: ${violations.map((violation) => violation.message).join(' ')}`);
  }
  return source;
}

function loadFilterRecipes(): Map<string, SvgFilterRecipe> {
  const recipes = new Map<string, SvgFilterRecipe>();
  for (const entry of listSvgFiles(recipesDir)) {
    const recipe = SvgFilterRecipe.parse(readSvgSource(join(recipesDir, entry)));
    recipes.set(recipe.name, recipe);
  }
  return recipes;
}

function listTemplateFolders(): string[] {
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
}

function resolveSourcePath(templateDir: string): string {
  const scssPath = join(templateDir, 'style.scss');
  if (existsSync(scssPath)) return scssPath;
  return join(templateDir, 'style.css');
}

function buildTemplate(templateName: string, expander: SvgRecipeExpander): void {
  const dir = join(templatesDir, templateName);
  const sourcePath = resolveSourcePath(dir);
  const registry = new TemplateStyleControlRegistry(controlCatalog);
  const animations = new TemplateAnimationRegistry();
  const fonts = new TemplateFontStackRegistry(new FontStackLibrary());
  const raw = extname(sourcePath) === '.scss'
    ? compile(sourcePath, {
        style: 'expanded',
        loadPaths: [primitivesDir],
        functions: {
          'tscaps-font-stack($id)': fontStackFunction(fonts),
          'tscaps-control-field($id, $default)': controlFieldFunction(registry),
          'tscaps-declared-animation($id, $element, $values, $keyframes)': declaredAnimationFunction(animations),
        },
      }).css
    : readFileSync(sourcePath, 'utf8');
  const css = normalizeCssForRuntime(raw);
  writeFileSync(join(dir, 'style.build.css'), css);
  buildControls(dir, registry);
  buildAnimations(dir, animations);
  buildFontStacks(dir, fonts);
  buildFilters(dir, expander);
}

/** Writes fixed font dependencies separately from user-facing controls. */
function buildFontStacks(dir: string, registry: TemplateFontStackRegistry): void {
  const buildPath = join(dir, 'fonts.build.json');
  const declared = registry.declared();
  if (declared.length === 0) {
    rmSync(buildPath, { force: true });
    return;
  }
  writeFileSync(buildPath, `${JSON.stringify(declared, null, 2)}\n`);
}

/**
 * Writes the controls the stylesheet declared while compiling. A
 * template whose stylesheet declares none gets no file, and a stale
 * one from an earlier build is removed rather than shipped.
 */
function buildControls(dir: string, registry: TemplateStyleControlRegistry): void {
  const buildPath = join(dir, 'controls.build.json');
  const declared = registry.declared();
  if (declared.length === 0) {
    rmSync(buildPath, { force: true });
    return;
  }
  writeFileSync(buildPath, `${JSON.stringify(declared, null, 2)}\n`);
}

/**
 * Writes the library animations the stylesheet applied while
 * compiling, each with the value this template gave its fields. A
 * template moving nothing, or moving on keyframes of its own, gets no
 * file, and a stale one from an earlier build is removed rather than
 * shipped.
 */
function buildAnimations(dir: string, registry: TemplateAnimationRegistry): void {
  const buildPath = join(dir, 'animations.build.json');
  const declared = registry.declared();
  if (declared.length === 0) {
    rmSync(buildPath, { force: true });
    return;
  }
  writeFileSync(buildPath, `${JSON.stringify(declared, null, 2)}\n`);
}

/**
 * Writes the template's filter document: its authored `filters.svg`
 * with every recipe call expanded. A template that authors none gets
 * no file, so the runtime's "does this template ship filters" check
 * stays meaningful — and a stale one left by an earlier build is
 * removed rather than shipped.
 */
function buildFilters(dir: string, expander: SvgRecipeExpander): void {
  const sourcePath = join(dir, 'filters.svg');
  const buildPath = join(dir, 'filters.build.svg');
  if (!existsSync(sourcePath)) {
    rmSync(buildPath, { force: true });
    return;
  }
  writeFileSync(buildPath, expander.expand(normalizeSvgForRuntime(readSvgSource(sourcePath))));
}

/**
 * Strips authoring-only noise (block comments — kept for humans
 * reading the source, useless in the runtime CSS) and normalizes
 * whitespace so both the Sass and pass-through paths produce output
 * of the same shape.
 */
function normalizeCssForRuntime(css: string): string {
  return dedupeKeyframes(css.replace(/\/\*[\s\S]*?\*\//g, ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

/**
 * The same strip for a filter document: XML comments explain the
 * authored source to whoever maintains it and say nothing to the
 * runtime, which drops them before parsing anyway. A comment holding
 * its own lines takes them with it, so removing one leaves no gap
 * where an author wrote none.
 *
 * Runs before recipe expansion, so a commented-out call stays out of
 * the built document rather than expanding inside the comment.
 */
function normalizeSvgForRuntime(svg: string): string {
  return svg
    .replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm, '')
    .replace(/[ \t]*<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

/**
 * Drops repeated `@keyframes` blocks whose text is byte-identical.
 * Animation primitives emit their keyframes at every call site, so a
 * template applying one primitive to two elements would otherwise ship
 * the same block twice. Blocks that share a name but differ in body are
 * left untouched: that is an authoring conflict worth seeing, not
 * something to resolve silently.
 */
function dedupeKeyframes(css: string): string {
  const seen = new Set<string>();
  const opener = /@keyframes\s+[\w-]+\s*\{/g;
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(css)) !== null) {
    const end = findBlockEnd(css, match.index + match[0].length - 1);
    const block = css.slice(match.index, end);
    out += css.slice(cursor, match.index);
    if (!seen.has(block)) {
      seen.add(block);
      out += block;
    }
    cursor = end;
    opener.lastIndex = end;
  }
  return out + css.slice(cursor);
}

function findBlockEnd(css: string, openBraceIndex: number): number {
  let depth = 0;
  for (let i = openBraceIndex; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i + 1;
  }
  throw new Error('Unbalanced braces in a @keyframes block');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function main(): void {
  let expander: SvgRecipeExpander;
  try {
    expander = new SvgRecipeExpander(loadFilterRecipes());
    buildAnimationPresets(primitivesDir);
  } catch (error) {
    console.error(`✗ library: ${describe(error)}`);
    process.exitCode = 1;
    return;
  }

  const folders = listTemplateFolders();
  let failed = 0;
  for (const name of folders) {
    try {
      buildTemplate(name, expander);
    } catch (error) {
      failed++;
      console.error(`✗ ${name}: ${describe(error)}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} template(s) failed to build.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${folders.length} templates built to style.build.css.`);
}

main();
