import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import {
  ANSWERED_BY_KIND,
  CAPTION_NODE_KINDS,
  CSS_CLASS_BY_NODE_KIND,
} from '@core/elements/domain/CaptionNodeKind';
import { CAPTION_ANIMATION_VARIABLES } from '@core/elements/domain/CaptionAnimationVariables';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { CaptionElementKind, ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';

const NO_ANIMATION = 'animation: none;';
const NO_SHORTHAND = 'none';
const INDENT = '  ';

/** Which end of a caption node's motion a scope answers. */
type CaptionEnd = 'entrance' | 'exit';

/**
 * The CSS an animation renders as, built from what was picked for it —
 * for one element's part, or for every element of a kind.
 *
 * One direction. The record says which animation and what its fields
 * hold; this says what that looks like in CSS, and nothing ever asks
 * the CSS the question back.
 *
 * **A caption node's two ends share one `animation`.** Each answer
 * publishes its own half in the custom property its kind keeps for that
 * end ({@link CAPTION_ANIMATION_VARIABLES}) and declares the one
 * `animation` that plays both, so an entrance and an exit given at
 * different levels — every word told how it arrives, one word told how
 * it leaves — play together rather than the later erasing the other.
 *
 * **Only an entrance takes over what it covers.** Giving a node an
 * entrance replaces whatever moved it before, so the generated boxes and
 * the nodes inside it that answer to it are silenced with it. An exit is
 * added to the motion already there, and silences nothing.
 *
 * An animation the catalogue no longer offers produces nothing rather
 * than a broken rule — a project saved against an older library keeps
 * rendering, minus an animation nobody can name.
 */
export class ElementAnimationCssBuilder {
  constructor(
    private readonly catalog: ElementAnimationCatalog,
    private readonly timingVariableResolver: ElementTimingVariableResolver,
    private readonly controlValues: ElementControlCssWriter,
  ) {}

  /**
   * The block for one of an element's parts, to sit inside that
   * element's own rule.
   *
   * A shot layer's block is its motion's declarations as the library
   * wrote them: they publish their own half for the stage to play, and
   * no template styles a layer, so nothing of a template's can be
   * running on it to silence.
   */
  build(animation: ElementAnimation, kind: ElementKind, scope: ElementAnimationScope): string {
    if (kind === 'layer') return this.buildForLayer(animation, scope);
    const reached = ANIMATED_KIND_BY_SCOPE[scope];
    const animatedKind = reached ?? kind;
    const end = this.endOf(scope);
    const subject = reached === null ? '&' : `& :where(.${CSS_CLASS_BY_NODE_KIND[reached]})`;
    if (animation.presetId === null) {
      return this.joined([
        this.aimedAt(this.stilled(animatedKind, end), scope),
        this.silencedUnder(subject, animatedKind, end, null),
      ], '\n');
    }
    const preset = this.catalog.byId(animation.presetId);
    if (!preset) return '';
    const timingVariable = this.timingVariableResolver.resolve(kind, scope);
    return this.joined([
      this.aimedAt(this.declarationsOf(preset, animation, animatedKind, end, timingVariable), scope),
      this.silencedUnder(subject, animatedKind, end, preset.generatedBox?.pseudo ?? null),
      this.generatedBoxUnder(subject, preset, timingVariable),
      '',
      this.keyframesOf(preset),
    ], '\n');
  }

  /**
   * The block for every element the scope names, as a rule of its own.
   *
   * No `:where` and no element around it: this lands in a layer of its
   * own, where nothing it could collide with lives, and an element
   * answering for itself wins by sitting in a later layer rather than
   * by out-weighing anything. Empty for a scope that names no kind —
   * there is no element here for `self` to mean.
   *
   * An entrance silences the elements' own generated boxes along with
   * them. A stylesheet can animate a `::before` — a highlight pill
   * growing behind its word — and that is a different element, so the
   * rule above never reaches it and the two would play at once.
   * Silencing is all that is right: the pill is not the word, and giving
   * it the word's new entrance would animate a box the answer never
   * mentioned.
   *
   * Every state of the element is already covered without naming one.
   * A word being narrated still carries `word`, so a rule on the bare
   * class lands on the same element as one on `word-being-narrated` and
   * beats it by layer. Nothing here enumerates states, and nothing
   * needs `!important`: that is reserved for a rule a user wrote by
   * hand, which is meant to win.
   */
  buildForEveryElement(animation: ElementAnimation, scope: ElementAnimationScope): string {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null) return '';
    const end = this.endOf(scope);
    const subject = `.${CSS_CLASS_BY_NODE_KIND[kind]}`;
    if (animation.presetId === null) {
      return this.joined([
        this.asOwnRule(this.stilled(kind, end), kind),
        this.silencedUnder(subject, kind, end, null),
      ], '\n\n');
    }
    const preset = this.catalog.byId(animation.presetId);
    if (!preset) return '';
    const timingVariable = this.timingVariableResolver.resolve(kind, scope);
    return this.joined([
      this.asOwnRule(this.declarationsOf(preset, animation, kind, end, timingVariable), kind),
      this.silencedUnder(subject, kind, end, preset.generatedBox?.pseudo ?? null),
      this.generatedBoxUnder(subject, preset, timingVariable),
      this.keyframesOf(preset),
    ], '\n\n');
  }

  /**
   * The CSS that moves values inside the animation a template already
   * applies to every element of a kind.
   *
   * No `animation` and no keyframes: the template's own rule still
   * declares both, and this only re-answers the custom properties that
   * rule reads. Which is what lets it reach a rule addressed by a
   * selector nothing here knows — the two land on the same element,
   * and layer order is settled before specificity is consulted.
   */
  buildTunedForEveryElement(
    values: Readonly<Record<string, AnimationValue>>,
    scope: ElementAnimationScope,
  ): string {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null) return '';
    const declarations = Object.entries(values).map(([property, value]) => `${property}: ${this.spelled(value)};`);
    return declarations.length === 0 ? '' : this.asOwnRule(declarations.join('\n'), kind);
  }

  private buildForLayer(animation: ElementAnimation, scope: ElementAnimationScope): string {
    if (animation.presetId === null) return NO_ANIMATION;
    const preset = this.catalog.byId(animation.presetId);
    if (!preset) return '';
    const timingVariable = this.timingVariableResolver.resolve('layer', scope);
    const declarations = this.withParams(this.catalog.declarationsFor(preset, timingVariable), preset.controls, animation.params);
    return `${declarations}\n\n${this.keyframesOf(preset)}`;
  }

  /** The preset's own declarations at the values recorded for it, then the half it publishes and the `animation` that plays both. */
  private declarationsOf(
    preset: ElementAnimationPreset,
    animation: ElementAnimation,
    kind: CaptionElementKind,
    end: CaptionEnd,
    timingVariable: string,
  ): string {
    const declarations = this.withParams(this.catalog.declarationsFor(preset, timingVariable), preset.controls, animation.params);
    const played = this.played(kind, end, this.catalog.animationFor(preset, timingVariable));
    return declarations.length > 0 ? `${declarations}\n${played}` : played;
  }

  /**
   * One end of `kind`'s motion told not to move.
   *
   * An entrance that does not move still replaces whatever moved the
   * element before, so it declares the `animation` both ends share, and
   * an exit given anywhere else plays through it. An exit that does not
   * move only takes back an exit that would reach it from further out:
   * it publishes nothing to play, and writing `animation` for it would
   * replace the motion the element already has for no exit at all.
   */
  private stilled(kind: CaptionElementKind, end: CaptionEnd): string {
    if (end === 'entrance') return this.played(kind, end, NO_SHORTHAND);
    return `${CAPTION_ANIMATION_VARIABLES[kind].exit}: ${NO_SHORTHAND};`;
  }

  /**
   * `shorthand` published as one end of `kind`'s motion, and the
   * declaration that plays both ends.
   *
   * The other end falls back to `none` where nothing published it, and
   * so does an end whose shorthand cannot be resolved on the element: a
   * custom property that fails to substitute is the guaranteed-invalid
   * value, which takes the fallback rather than invalidating the whole
   * `animation` along with the half that did resolve.
   */
  private played(kind: CaptionElementKind, end: CaptionEnd, shorthand: string): string {
    const variables = CAPTION_ANIMATION_VARIABLES[kind];
    return [
      `${variables[end]}: ${shorthand};`,
      `animation: var(${variables.entrance}, none), var(${variables.exit}, none);`,
    ].join('\n');
  }

  /**
   * Everything an entrance about `kind` takes over, given the selector
   * `answered` that reaches those elements, or `null` for an exit, which
   * takes over nothing.
   *
   * Its own generated boxes, and every node inside it that no answer of
   * its own covers — a line under a caption, a letter under a word.
   * Read off `ANSWERED_BY_KIND`, so a node kind added later is silenced
   * by whichever answer claims it rather than left animating under one
   * that replaced it.
   *
   * No pseudo-element exists unless the stylesheet gave it `content`,
   * and no class matches a node the document does not emit, so this
   * reaches nothing on a caption that has none.
   */
  private silencedUnder(
    answered: string,
    kind: CaptionElementKind,
    end: CaptionEnd,
    ownedBox: string | null,
  ): string | null {
    if (end === 'exit') return null;
    const subjects = [answered];
    for (const node of CAPTION_NODE_KINDS) {
      if (node === kind || ANSWERED_BY_KIND[node] !== kind) continue;
      subjects.push(`${answered} .${CSS_CLASS_BY_NODE_KIND[node]}`);
    }
    const selectors = subjects.flatMap((subject) => {
      const boxes = [`${subject}::before`, `${subject}::after`];
      // Only the answered element's own box may be spared, and only the
      // one the entrance paints. A box under a node further in belongs
      // to whatever drew it, which this is here to stop.
      if (subject !== answered || ownedBox === null) return boxes;
      return boxes.filter((selector) => selector !== `${subject}${ownedBox}`);
    });
    for (const subject of subjects.slice(1)) selectors.push(subject);
    return `${selectors.join(', ')} {\n${INDENT}${NO_ANIMATION}\n}`;
  }

  /**
   * The rule for the box an entrance paints of its own, or `null` where
   * it paints none.
   *
   * Written under the same selector the entrance's own declarations
   * landed on, so the two reach the same elements — and after the
   * silencing, which spares this box by name rather than by order.
   */
  private generatedBoxUnder(
    subject: string,
    preset: ElementAnimationPreset,
    timingVariable: string,
  ): string | null {
    const box = preset.generatedBox;
    if (box === null) return null;
    const declarations = box.declarationsByTimingVariable[timingVariable];
    if (declarations === undefined) return null;
    return `${subject}${box.pseudo} {\n${this.indented(declarations)}\n}`;
  }

  /** Every `@keyframes` block the entrance moves, its own box's included. */
  private keyframesOf(preset: ElementAnimationPreset): string {
    if (preset.generatedBox === null) return preset.keyframes;
    return `${preset.keyframes}\n\n${preset.generatedBox.keyframes}`;
  }

  /** Which end of its node's motion a caption scope answers: every scope a caption offers has one of the two. */
  private endOf(scope: ElementAnimationScope): CaptionEnd {
    return ANIMATION_PHASE_BY_SCOPE[scope] === 'exit' ? 'exit' : 'entrance';
  }

  private spelled(value: AnimationValue): string {
    return value.kind === 'number' ? `${value.amount}${value.unit}` : value.text;
  }

  private asOwnRule(declarations: string, kind: CaptionElementKind): string {
    return `.${CSS_CLASS_BY_NODE_KIND[kind]} {\n${this.indented(declarations)}\n}`;
  }

  /**
   * The declarations wrapped in whatever it takes to land them on the
   * scope's own elements.
   *
   * A scope reaching inside is written with `:where`, so it carries no
   * specificity of its own: an element addressed directly and an
   * element reached through the one around it then meet at the same
   * weight, and the order they are written in is what separates them.
   */
  private aimedAt(declarations: string, scope: ElementAnimationScope): string {
    const reached = ANIMATED_KIND_BY_SCOPE[scope];
    if (reached === null) return declarations;
    return `& :where(.${CSS_CLASS_BY_NODE_KIND[reached]}) {\n${this.indented(declarations)}\n}`;
  }

  private indented(declarations: string): string {
    return declarations
      .split('\n')
      .map((line) => (line.trim().length > 0 ? `${INDENT}${line}` : line))
      .join('\n');
  }

  /** The parts that hold something, in order, as one text. */
  private joined(parts: ReadonlyArray<string | null>, separator: string): string {
    return parts.filter((part): part is string => part !== null).join(separator);
  }

  /**
   * The animation's own declarations, moved to where the fields were
   * left. Written through the same arithmetic a field writes with,
   * because a direction and a distance can share one declaration and
   * neither may drop the other's half.
   */
  private withParams(
    declarations: string,
    controls: ReadonlyArray<ElementControl>,
    params: ElementAnimation['params'],
  ): string {
    let css = declarations;
    for (const control of controls) {
      const value = params[control.id];
      if (value !== undefined) css = this.controlValues.write(css, control, value);
    }
    return css;
  }
}
