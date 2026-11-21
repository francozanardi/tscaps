import { Decoration, Letter, Line, Segment, Word } from '@tscaps/engine';
import type { CaptionElementKind } from '@core/elements/domain/ElementKind';

/**
 * Every kind of node a caption paints, whether or not anyone can
 * address it.
 *
 * Wider than `ElementKind`, which is what can be selected and styled on
 * its own: a template styles lines and letters that carry no identity
 * of their own, and it animates them.
 */
export const CAPTION_NODE_KINDS = ['segment', 'line', 'word', 'letter', 'decoration'] as const;

export type CaptionNodeKind = (typeof CAPTION_NODE_KINDS)[number];

/** The class each kind of node carries, as the renderer emits it. */
export const CSS_CLASS_BY_NODE_KIND: Readonly<Record<CaptionNodeKind, string>> = {
  segment: Segment.CSS_CLASS,
  line: Line.CSS_CLASS,
  word: Word.CSS_CLASS,
  letter: Letter.CSS_CLASS,
  decoration: Decoration.CSS_CLASS,
};

/**
 * Whose answer a node's movement belongs to: the nearest kind a sheet
 * or an element can be asked about.
 *
 * A line and a letter have no panel of their own, so nothing can ever
 * be said about them separately — how a line arrives is part of how its
 * caption arrives, and how a letter appears is part of how its word
 * appears. Saying how captions arrive therefore has to take over what
 * their lines were doing, or the two play at once.
 *
 * A decoration answers for itself, so a word's answer leaves it alone
 * even though it sits inside one.
 *
 * Exhaustive on purpose. A kind added to `CAPTION_NODE_KINDS` cannot
 * compile without a row here, so nobody has to remember that a new node
 * would otherwise go on animating under an answer that replaced it.
 */
export const ANSWERED_BY_KIND: Readonly<Record<CaptionNodeKind, CaptionElementKind>> = {
  segment: 'segment',
  line: 'segment',
  word: 'word',
  letter: 'word',
  decoration: 'decoration',
};
