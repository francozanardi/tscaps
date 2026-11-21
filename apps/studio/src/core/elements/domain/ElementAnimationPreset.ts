import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';

/**
 * A box an entrance paints of its own, over the element it enters.
 *
 * A pseudo-element rather than a layer of the element itself, because
 * the only thing that can cover an element's own text is a child, and a
 * generated one is the only child an entrance may invent. An entrance
 * declaring one takes it back from the silencing that otherwise stops
 * every generated box under a new answer — its own box is part of the
 * answer rather than a leftover of the one before.
 */
export interface ElementAnimationGeneratedBox {
  /** Which box it is, spelled as it selects: `::before` or `::after`. */
  readonly pseudo: string;
  /** The `@keyframes` block moving it, separate from the element's own. */
  readonly keyframes: string;
  /** Its declarations, keyed by the clock the element's animation is delayed by. */
  readonly declarationsByTimingVariable: Readonly<Record<string, string>>;
}

/**
 * One entrance an element can be given, as the CSS that expresses it.
 *
 * Compiled from the animation library, so an entrance picked here and
 * the same entrance used by a template are the same motion rather than
 * two copies that drift.
 *
 * Applying an entrance writes these declarations and this block into
 * the element's own CSS, where they stay readable and editable.
 */
export interface ElementAnimationPreset {
  readonly id: string;
  /**
   * The kinds of element it was compiled for, which is where it may be
   * offered. An entrance the library writes for one kind alone exists
   * for that kind alone; asking a catalogue for the rest gets nothing
   * rather than an entrance that would land on a clock it never saw.
   *
   * Kinds rather than clocks, because two kinds can share one: a
   * decoration runs on the word's, so a list keyed by the clock could
   * not tell an entrance meant for words from one meant for emojis.
   */
  readonly kinds: ReadonlyArray<ElementKind>;
  /** The `@keyframes` name its animation references, which is how the entrance is recognised in CSS later. */
  readonly keyframeName: string;
  /** The custom properties its declarations set, so replacing an entrance can take the previous one's out. */
  readonly customProperties: ReadonlyArray<string>;
  /** The `@keyframes` block, which is the same whichever clock the element anchors to. */
  readonly keyframes: string;
  /**
   * The declarations, keyed by the clock variable their animation is
   * delayed by: everything the motion sets except the `animation` that
   * plays it, which is kept apart in `animationByTimingVariable`.
   */
  readonly declarationsByTimingVariable: Readonly<Record<string, string>>;
  /**
   * The `animation` shorthand that plays it, keyed by the same clocks.
   *
   * Apart from the other declarations because an element plays its
   * entrance and its exit through one `animation`, and each end can be
   * answered somewhere else — the caption's words told how they arrive,
   * one word told how it leaves — so neither may write it whole. Each
   * publishes its half and one declaration plays both.
   *
   * Empty for a motion whose declarations already publish their own
   * half, as a shot layer's do for the stage that plays them.
   */
  readonly animationByTimingVariable: Readonly<Record<string, string>>;
  /** The box it paints over the element, or `null` where it paints none. */
  readonly generatedBox: ElementAnimationGeneratedBox | null;
  /** The fields the editor offers for it, in the order they are shown. */
  readonly controls: ReadonlyArray<ElementControl>;
  /** The picture a picker draws it as: one `<svg>`, monochrome through `currentColor`. */
  readonly icon: string;
}
