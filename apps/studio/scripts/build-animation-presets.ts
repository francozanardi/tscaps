import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { CssKeyframesScanner, CssMinifier, CssCustomPropertyDefinitionScanner } from '@tscaps/engine/advanced';
import type { AuthoredElementControl, ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { TemplateAnimationRegistry } from '@core/templates/services/animations/TemplateAnimationRegistry';
import { TemplateStyleControlRegistry } from '@core/templates/services/controls/TemplateStyleControlRegistry';
import { controlFieldFunction } from './control-field-function';
import { declaredAnimationFunction } from './declared-animation-function';

const SOURCE_MODULE = 'presets';
const OUTPUT_FILE = 'presets.build.json';
const CONTROLS_FILE = 'controls.json';
const ICON_FILE = 'icon.svg';

const keyframesScanner = new CssKeyframesScanner();
const minifier = new CssMinifier();
const customPropertyScanner = new CssCustomPropertyDefinitionScanner();
const timingVariableResolver = new ElementTimingVariableResolver();
const controlValueParser = new ElementControlValueParser();

/**
 * The parts of its life an element of each kind moves in on its own
 * clock: a caption's element enters and leaves; a shot layer enters,
 * leaves, and moves for as long as it shows.
 */
const OWN_SCOPES_BY_KIND: Readonly<Record<ElementKind, ReadonlyArray<ElementAnimationScope>>> = {
  segment: [ElementAnimationScope.SELF, ElementAnimationScope.EXIT],
  line: [ElementAnimationScope.SELF, ElementAnimationScope.EXIT],
  word: [ElementAnimationScope.SELF, ElementAnimationScope.EXIT],
  decoration: [ElementAnimationScope.SELF, ElementAnimationScope.EXIT],
  layer: [ElementAnimationScope.ENTRANCE, ElementAnimationScope.EXIT, ElementAnimationScope.CAMERA],
};

/**
 * One list of motions and where it lives: its folder, holding
 * `presets.scss` (the list) and a folder per motion with its fields and
 * its picture; the folders its primitives `@use` from beyond it; the
 * element kinds it is compiled for; and what the build calls it.
 */
export interface AnimationLibrarySource {
  readonly animationDir: string;
  readonly loadPaths: ReadonlyArray<string>;
  readonly kinds: ReadonlyArray<ElementKind>;
  readonly label: string;
}

/** The part of its life a list is compiled for, as the library's stylesheet names it. */
type LibraryEdge = 'entrance' | 'exit' | 'camera';

/** A preset rule's declarations, with the `animation` that plays it taken out where it writes one. */
interface SplitDeclarations {
  readonly declarations: string;
  readonly animation: string | null;
}

/** The slot `declared.plays` publishes a caption node's end in, up to the shorthand it holds. */
const PUBLISHED_END = /^--(segment|line|word|decoration)-(entrance|exit)-animation\s*:\s*/;

/** The `animation` `declared.plays` writes beside it, which plays both of the kind's ends. */
const PLAYS_BOTH_ENDS = /^animation\s*:\s*var\(--(segment|line|word|decoration)-entrance-animation, none\), var\(--\1-exit-animation, none\);$/;

/** A top-level block of a compiled stylesheet: what precedes its braces, and what they hold. */
interface CssBlock {
  readonly prelude: string;
  readonly body: string;
  readonly text: string;
}

/** One compile of the entrance list: what it rendered as, and what each entrance said about itself. */
interface CompiledLibrary {
  readonly css: string;
  readonly declared: readonly DeclaredAnimation[];
}

/** An entrance as compiled, before the editor's fields and its picture are attached to it. */
type CompiledPreset = Omit<ElementAnimationPreset, 'controls' | 'icon'>;

/** An entrance with its fields attached, still waiting for its picture. */
type PresetWithControls = Omit<ElementAnimationPreset, 'icon'>;

/**
 * Compiles the animation library's entrance list once per clock an
 * element can anchor to — a shot layer's exit is a clock of its own, and
 * so is its whole stretch — and writes the result beside it.
 *
 * The list is the stylesheet's own: one rule per entrance, the selector
 * naming it. Nothing here decides which entrances exist, so adding one
 * is an edit to the stylesheet alone.
 */
export function buildAnimationPresets(library: AnimationLibrarySource): void {
  const { animationDir } = library;
  const presets = new Map<string, CompiledPreset>();
  const declared = new Map<string, Readonly<Record<string, AnimationValue>>>();
  for (const kind of library.kinds) {
    for (const scope of OWN_SCOPES_BY_KIND[kind]) {
      const timingVariable = timingVariableResolver.resolve(kind, scope);
      const edge = edgeOf(scope);
      const compiled = compilePresets(library, kind, timingVariable, edge);
      collectInto(presets, kind, timingVariable, compiled.css);
      for (const animation of compiled.declared) declared.set(animation.id, animation.values);
    }
  }
  if (presets.size === 0) throw new Error(`${library.label}: ${SOURCE_MODULE} declared no entrances.`);
  const built = attachIcons(attachControls([...presets.values()], animationDir, declared), animationDir);
  writeFileSync(
    join(animationDir, OUTPUT_FILE),
    `${JSON.stringify(built, null, 2)}\n`,
  );
  console.log(`✓ ${built.length} ${library.label} motions built to ${OUTPUT_FILE}.`);
}

/**
 * Gives each entrance the picture the editor draws it as.
 *
 * Authored beside the animation rather than derived from it: the
 * library is written in `em` against caption text, so an entrance
 * rendered at the size of a picker card moves a pixel or two and shows
 * nothing. Every entrance must have one, so adding one to the
 * stylesheet is a decision about how it is recognised rather than a
 * silent blank.
 */
function attachIcons(presets: PresetWithControls[], animationDir: string): ElementAnimationPreset[] {
  return presets.map((preset) => {
    const path = join(animationDir, preset.id, ICON_FILE);
    if (!existsSync(path)) {
      throw new Error(`Entrance "${preset.id}" has no icon. Draw one at animation/${preset.id}/${ICON_FILE}.`);
    }
    return { ...preset, icon: collapseWhitespace(readFileSync(path, 'utf8')) };
  });
}

function collapseWhitespace(svg: string): string {
  return svg.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

/**
 * The fields one animation declares for itself, in the order it lists
 * them.
 *
 * Every animation carries the file, with `[]` where it offers none, so
 * writing one is a decision about what it exposes rather than a silent
 * no. Animations the picker never offers carry it too: a template
 * applying one still wants its fields.
 */
function readAuthoredControls(animationDir: string, id: string): AuthoredElementControl[] {
  const path = join(animationDir, id, CONTROLS_FILE);
  if (!existsSync(path)) {
    throw new Error(`Animation "${id}" declares no fields. Write animation/${id}/${CONTROLS_FILE}, with [] if it offers none.`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as AuthoredElementControl[];
}

/** Gives each entrance the fields the editor offers for it, and the value it ships each at. */
function attachControls(
  presets: ReadonlyArray<CompiledPreset>,
  animationDir: string,
  declared: ReadonlyMap<string, Readonly<Record<string, AnimationValue>>>,
): PresetWithControls[] {
  return presets.map((preset) => {
    const authoredControls = readAuthoredControls(animationDir, preset.id);
    rejectUnreachableControls(preset, authoredControls);
    rejectHalfSplitControls(preset, authoredControls);
    const values = declared.get(preset.id) ?? {};
    const controls = authoredControls.map((control) => ({
      ...control,
      defaultValue: shippedValue(preset, control, values),
    }));
    return { ...preset, controls };
  });
}

/**
 * A control can only drive a property the entrance declares for
 * itself. One it merely reads belongs to whatever scope wrote it, and
 * a field over that would either move nothing or reach outside the
 * element it is shown for.
 */
function rejectUnreachableControls(preset: CompiledPreset, controls: ReadonlyArray<AuthoredElementControl>): void {
  for (const control of controls) {
    if (preset.customProperties.includes(control.property)) continue;
    throw new Error(`Entrance "${preset.id}" offers "${control.label}" over ${control.property}, which it never declares.`);
  }
}

/**
 * A signed value split between a direction and a distance needs both
 * halves. One alone either loses the direction or cannot express one.
 */
function rejectHalfSplitControls(preset: CompiledPreset, controls: ReadonlyArray<AuthoredElementControl>): void {
  for (const control of controls) {
    if (control.part === 'whole') continue;
    const partner = control.part === 'sign' ? 'magnitude' : 'sign';
    if (controls.some((other) => other.property === control.property && other.part === partner)) continue;
    throw new Error(`Entrance "${preset.id}" splits ${control.property} but offers no ${partner} to go with its ${control.part}.`);
  }
}

/**
 * The value the entrance ships this field at, taken from what the
 * entrance declared.
 *
 * The same record a template's own animations produce, so the number a
 * field starts on and the number the entrance renders at are one value
 * rather than two readings of it. Throws where a template would only
 * lose a dial: an entrance whose fields and declarations disagree is
 * the library contradicting itself.
 */
function shippedValue(
  preset: CompiledPreset,
  control: AuthoredElementControl,
  values: Readonly<Record<string, AnimationValue>>,
): ElementControlValue {
  const declared = values[control.property];
  if (declared === undefined) {
    throw new Error(`Entrance "${preset.id}" offers "${control.label}" over ${control.property}, which it never sets a value for.`);
  }
  const held = controlValueParser.parse(control, declared);
  if (held === null) {
    throw new Error(`Entrance "${preset.id}" ships "${control.label}" as something its field cannot hold.`);
  }
  return held;
}

function edgeOf(scope: ElementAnimationScope): LibraryEdge {
  if (scope === ElementAnimationScope.EXIT) return 'exit';
  if (scope === ElementAnimationScope.CAMERA) return 'camera';
  return 'entrance';
}

function compilePresets(library: AnimationLibrarySource, kind: ElementKind, timingVariable: string, edge: LibraryEdge): CompiledLibrary {
  const registry = new TemplateStyleControlRegistry(new StyleControlCatalog(new SimilarNameFinder()));
  // The entrance list is not a template, but what the primitives
  // declare about themselves here is the same record, and it is where
  // each field's shipped value comes from.
  const animations = new TemplateAnimationRegistry();
  const css = compileString(
    `@use '${SOURCE_MODULE}';\n@include presets.all(var(${timingVariable}), '${kind}', '${edge}');\n`,
    {
      style: 'expanded',
      loadPaths: [library.animationDir, ...library.loadPaths],
      functions: {
        'tscaps-control-field($id, $default)': controlFieldFunction(registry),
        'tscaps-declared-animation($id, $element, $values, $keyframes, $end: entrance)': declaredAnimationFunction(animations),
      },
    },
  ).css;
  return { css: stripComments(css).replace(/@charset[^;]*;/g, ''), declared: animations.declared() };
}

/**
 * Folds one compilation into the entrances collected so far. The first
 * clock establishes each entrance; later ones contribute only their
 * declarations, and must agree on everything else.
 */
function collectInto(
  presets: Map<string, CompiledPreset>,
  kind: ElementKind,
  timingVariable: string,
  css: string,
): void {
  const blocks = topLevelBlocks(css);
  const keyframesByName = keyframeBlocksByName(blocks);
  const rules = blocks.filter(isPresetRule);
  for (const rule of rules.filter((candidate) => !isGeneratedBoxRule(candidate))) {
    collectEntrance(presets, rule, kind, timingVariable, keyframesByName);
  }
  // After the entrances, because a box belongs to one and cannot be
  // folded into an entrance that has not been read yet.
  for (const rule of rules.filter(isGeneratedBoxRule)) {
    collectGeneratedBox(presets, rule, timingVariable, keyframesByName);
  }
  rejectSharedKeyframes(presets);
}

function collectEntrance(
  presets: Map<string, CompiledPreset>,
  rule: CssBlock,
  kind: ElementKind,
  timingVariable: string,
  keyframesByName: ReadonlyMap<string, string>,
): void {
  const id = rule.prelude.trim().slice(1);
  const body = dedent(rule.body);
  const keyframeName = soleKeyframeReference(id, body);
  const keyframes = keyframesByName.get(keyframeName);
  if (!keyframes) {
    throw new Error(`Entrance "${id}" animates "${keyframeName}", which the library never defines.`);
  }
  const { declarations, animation } = splitAnimation(id, body);
  const played = animation === null ? {} : { [timingVariable]: animation };
  const existing = presets.get(id);
  if (!existing) {
    presets.set(id, {
      id,
      kinds: [kind],
      keyframeName,
      customProperties: [...customPropertyScanner.scan(minifier.minify(declarations))],
      keyframes,
      declarationsByTimingVariable: { [timingVariable]: declarations },
      animationByTimingVariable: played,
      generatedBox: null,
    });
    return;
  }
  if (existing.keyframes !== keyframes) {
    throw new Error(`Entrance "${id}" compiles different keyframes depending on the clock it anchors to.`);
  }
  presets.set(id, {
    ...existing,
    kinds: existing.kinds.includes(kind) ? existing.kinds : [...existing.kinds, kind],
    declarationsByTimingVariable: { ...existing.declarationsByTimingVariable, [timingVariable]: declarations },
    animationByTimingVariable: { ...existing.animationByTimingVariable, ...played },
  });
}

/**
 * Takes the shorthand a caption's motion plays out of its other
 * declarations.
 *
 * A caption node plays its entrance and its exit through one
 * `animation`, each end answered on its own. The library writes a
 * motion the way a template plays it, through `declared.plays`: the
 * shorthand published in its end's slot, and the `animation` that plays
 * both ends. The editor publishes each answer itself, at the level it
 * was given, so both come out here and only the shorthand is kept. A
 * shot layer's motion writes neither — it publishes its half under the
 * layer's own name, for the stage to play — and keeps its declarations
 * whole.
 *
 * The rest stays exactly as compiled, line for line: what a saved
 * project carries is that text, and it is found again by being spelled
 * the same.
 */
function splitAnimation(id: string, body: string): SplitDeclarations {
  const lines = body.split('\n');
  const played = lines.filter((line) => /^animation\s*:/.test(line) && !PLAYS_BOTH_ENDS.test(line.trim()));
  if (played.length > 0) {
    throw new Error(`"${id}" writes "animation" itself. A caption's motion goes through \`declared.plays\`, `
      + 'which publishes it in its end\'s slot for the editor to play.');
  }
  const starts = lines.flatMap((line, index) => (PUBLISHED_END.test(line) ? [index] : []));
  if (starts.length === 0) return { declarations: body, animation: null };
  if (starts.length > 1) {
    throw new Error(`"${id}" publishes more than one end, so which one plays it is a matter of order.`);
  }
  const start = starts[0]!;
  let end = start;
  while (end < lines.length - 1 && !lines[end]!.trimEnd().endsWith(';')) end++;
  const declaration = lines.slice(start, end + 1).join(' ').trim();
  const animation = declaration.replace(PUBLISHED_END, '').replace(/;$/, '').trim();
  const declarations = [...lines.slice(0, start), ...lines.slice(end + 1)]
    .filter((line) => !PLAYS_BOTH_ENDS.test(line.trim()))
    .join('\n');
  return { declarations, animation };
}

/**
 * Folds a rule written for an entrance's own generated box into that
 * entrance, rather than reading it as a second entrance whose name
 * happens to carry a pseudo-element.
 */
function collectGeneratedBox(
  presets: Map<string, CompiledPreset>,
  rule: CssBlock,
  timingVariable: string,
  keyframesByName: ReadonlyMap<string, string>,
): void {
  const selector = rule.prelude.trim();
  const separator = selector.indexOf('::');
  const id = selector.slice(1, separator);
  const pseudo = selector.slice(separator);
  const entrance = presets.get(id);
  if (!entrance) {
    throw new Error(`A generated box was written as "${selector}", but "${id}" is not an entrance.`);
  }
  const declarations = dedent(rule.body);
  const keyframeName = soleKeyframeReference(selector, declarations);
  const keyframes = keyframesByName.get(keyframeName);
  if (!keyframes) {
    throw new Error(`Entrance "${id}" moves its ${pseudo} with "${keyframeName}", which the library never defines.`);
  }
  const existing = entrance.generatedBox;
  if (existing && existing.pseudo !== pseudo) {
    throw new Error(`Entrance "${id}" paints a ${existing.pseudo} for one kind of element and a ${pseudo} for another.`);
  }
  presets.set(id, {
    ...entrance,
    generatedBox: {
      pseudo,
      keyframes,
      declarationsByTimingVariable: {
        ...existing?.declarationsByTimingVariable,
        [timingVariable]: declarations,
      },
    },
  });
}

function isGeneratedBoxRule(block: CssBlock): boolean {
  return block.prelude.includes('::');
}

/**
 * An entrance is recognised in a user's CSS by the keyframes its
 * animation names, so two entrances sharing one would be
 * indistinguishable once written.
 */
function rejectSharedKeyframes(presets: ReadonlyMap<string, CompiledPreset>): void {
  const owners = new Map<string, string>();
  for (const preset of presets.values()) {
    const owner = owners.get(preset.keyframeName);
    if (owner && owner !== preset.id) {
      throw new Error(
        `Entrances "${owner}" and "${preset.id}" both animate "${preset.keyframeName}", `
        + 'so neither could be told from the other once written into an element.',
      );
    }
    owners.set(preset.keyframeName, preset.id);
  }
}

function soleKeyframeReference(id: string, declarations: string): string {
  const referenced = [...keyframesScanner.referencedNames(minifier.minify(declarations))];
  if (referenced.length === 1) return referenced[0]!;
  if (referenced.length === 0) throw new Error(`Entrance "${id}" animates nothing.`);
  throw new Error(
    `Entrance "${id}" animates ${referenced.length} keyframes at once. `
    + 'A primitive writes its own "animation", so combining two keeps only the second.',
  );
}

function isPresetRule(block: CssBlock): boolean {
  return block.prelude.trim().startsWith('.');
}

function keyframeBlocksByName(blocks: ReadonlyArray<CssBlock>): Map<string, string> {
  const byName = new Map<string, string>();
  for (const block of blocks) {
    for (const name of keyframesScanner.definedNames(block.prelude)) {
      byName.set(name, block.text.trim());
    }
  }
  return byName;
}

function topLevelBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open === -1) break;
    const close = matchingClose(css, open);
    blocks.push({
      prelude: css.slice(cursor, open),
      body: css.slice(open + 1, close),
      text: css.slice(cursor, close + 1).trim(),
    });
    cursor = close + 1;
  }
  return blocks;
}

function matchingClose(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  throw new Error('Unbalanced braces in the compiled entrance list.');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Drops the indentation a rule's body carries from sitting inside it, so the declarations read as written. */
function dedent(body: string): string {
  const lines = body.split('\n').filter((line) => line.trim().length > 0);
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent)).join('\n');
}
