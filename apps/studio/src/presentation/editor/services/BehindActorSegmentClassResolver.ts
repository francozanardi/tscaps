import { CssClass, type Segment } from '@tscaps/engine';

const WHOLE: ReadonlyArray<string> = [CssClass.BEHIND_ACTOR_ACTIVE];
const PARTIAL: ReadonlyArray<string> = [CssClass.BEHIND_ACTOR_PARTIAL];
const NONE: ReadonlyArray<string> = [];

/**
 * The class the preview puts on a caption's segment for the
 * text-behind-actor effect: one when the effect holds the caption
 * whole, another when it holds only some of the words or glyphs in it,
 * none otherwise.
 *
 * Each answer is one shared array, so a caller memoizing on it keeps
 * the same identity across calls that change nothing.
 */
export class BehindActorSegmentClassResolver {
  classesFor(segment: Segment, behindWhole: boolean, elementsBehind: ReadonlySet<string>): ReadonlyArray<string> {
    if (behindWhole) return WHOLE;
    return this.holdsElementBehind(segment, elementsBehind) ? PARTIAL : NONE;
  }

  private holdsElementBehind(segment: Segment, elementsBehind: ReadonlySet<string>): boolean {
    if (elementsBehind.size === 0) return false;
    return segment.lines.some((line) => line.words.some((word) =>
      elementsBehind.has(word.id) || (word.decoration !== null && elementsBehind.has(word.decoration.id))));
  }
}
