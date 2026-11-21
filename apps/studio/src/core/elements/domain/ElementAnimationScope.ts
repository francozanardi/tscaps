import type { CaptionElementKind } from '@core/elements/domain/ElementKind';

/**
 * What an animation moves, and when in its life it moves it.
 *
 * Two questions answered by one key. *What* is the element itself or
 * every part of a kind inside it, one after another, each on its own
 * clock: doing that part by part is the same choice repeated, and it
 * stops being the caption's answer the moment a word or a glyph is
 * added. *When* is as it comes onto the frame or as it leaves it. A
 * sheet answers the same questions for everything rendering under it,
 * which is why the scopes that name a kind carry no mention of an
 * element.
 *
 * Not a property of the animation: the same entrance means the same
 * motion whichever scope it is given to. It decides which element wears
 * the declarations and which clock they anchor to, and nothing else.
 */
export enum ElementAnimationScope {
  /** The element itself, as it comes in. Meaningless without one, so a sheet never offers it. */
  SELF = 'self',
  /** Every caption, as it comes in. */
  SEGMENTS = 'segments',
  /** Every word, as it comes in. */
  WORDS = 'words',
  /** Every glyph attached to a word, as it comes in. */
  EMOJIS = 'emojis',
  /** A shot layer, as it comes onto the frame: on the clock of its start. */
  ENTRANCE = 'entrance',
  /**
   * The element itself, as it leaves the frame: on the clock of its end.
   * A caption's parts leave with their caption, so for anything in one
   * that end is the caption's.
   */
  EXIT = 'exit',
  /** Every caption, as it leaves. */
  SEGMENTS_EXIT = 'segments-exit',
  /** Every word, as it leaves: with its caption. */
  WORDS_EXIT = 'words-exit',
  /** Every glyph attached to a word, as it leaves: with its caption. */
  EMOJIS_EXIT = 'emojis-exit',
  /**
   * A shot's own video, as its camera moves over it: a move of its own
   * time, listed apart from the other parts of a layer's life.
   */
  CAMERA = 'camera',
}

/** When in an element's life a scope moves it: as it comes in, as it leaves, or for as long as it shows. */
export type ElementAnimationPhase = 'entrance' | 'exit' | 'camera';

export const ELEMENT_ANIMATION_SCOPES: ReadonlyArray<ElementAnimationScope> = [
  ElementAnimationScope.SELF,
  ElementAnimationScope.SEGMENTS,
  ElementAnimationScope.WORDS,
  ElementAnimationScope.EMOJIS,
  ElementAnimationScope.ENTRANCE,
  ElementAnimationScope.EXIT,
  ElementAnimationScope.SEGMENTS_EXIT,
  ElementAnimationScope.WORDS_EXIT,
  ElementAnimationScope.EMOJIS_EXIT,
  ElementAnimationScope.CAMERA,
];

/**
 * The scopes a sheet can answer: every one that names a kind of its
 * own. A sheet is not a rendered element, so `self` and `exit` would
 * have nothing to land on.
 */
export const SHEET_ANIMATION_SCOPES: ReadonlyArray<ElementAnimationScope> = [
  ElementAnimationScope.SEGMENTS,
  ElementAnimationScope.WORDS,
  ElementAnimationScope.EMOJIS,
  ElementAnimationScope.SEGMENTS_EXIT,
  ElementAnimationScope.WORDS_EXIT,
  ElementAnimationScope.EMOJIS_EXIT,
];

/**
 * The kind of element a scope animates inside the one it was given to,
 * or `null` for the element itself.
 *
 * One answer, three uses: it names the selector the declarations are
 * wrapped in, the clock they anchor to, and what an answer given here
 * reaches. Derived from one place so a scope cannot end up writing a
 * selector for one kind and a clock for another. An entrance and an exit
 * of the same part move the same element, and differ only in their
 * clock.
 */
export const ANIMATED_KIND_BY_SCOPE: Readonly<Record<ElementAnimationScope, CaptionElementKind | null>> = {
  [ElementAnimationScope.SELF]: null,
  [ElementAnimationScope.SEGMENTS]: 'segment',
  [ElementAnimationScope.WORDS]: 'word',
  [ElementAnimationScope.EMOJIS]: 'decoration',
  [ElementAnimationScope.ENTRANCE]: null,
  [ElementAnimationScope.EXIT]: null,
  [ElementAnimationScope.SEGMENTS_EXIT]: 'segment',
  [ElementAnimationScope.WORDS_EXIT]: 'word',
  [ElementAnimationScope.EMOJIS_EXIT]: 'decoration',
  [ElementAnimationScope.CAMERA]: null,
};

/**
 * When in its life each scope moves what it moves.
 *
 * The other half of the key. Two scopes that reach the same element and
 * differ here are the two ends of one part — the entrance and the exit
 * a panel shows side by side — and they share the element's one
 * `animation`, which is why an answer at one end has to leave room for
 * the other.
 */
export const ANIMATION_PHASE_BY_SCOPE: Readonly<Record<ElementAnimationScope, ElementAnimationPhase>> = {
  [ElementAnimationScope.SELF]: 'entrance',
  [ElementAnimationScope.SEGMENTS]: 'entrance',
  [ElementAnimationScope.WORDS]: 'entrance',
  [ElementAnimationScope.EMOJIS]: 'entrance',
  [ElementAnimationScope.ENTRANCE]: 'entrance',
  [ElementAnimationScope.EXIT]: 'exit',
  [ElementAnimationScope.SEGMENTS_EXIT]: 'exit',
  [ElementAnimationScope.WORDS_EXIT]: 'exit',
  [ElementAnimationScope.EMOJIS_EXIT]: 'exit',
  [ElementAnimationScope.CAMERA]: 'camera',
};
