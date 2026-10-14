import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { CaptionStacking } from '@modules/rendering/types/CaptionStacking';
import type { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';

/**
 * Render-time overrides for one element (segment or word), layered on
 * top of the style's root-level defaults. The fields are independent
 * and optional; an entry where all are absent is equivalent to the
 * absence of the entry and should be omitted by builders.
 *
 * `inlineStyles` lands on the element's `style="..."` attribute (CSS
 * custom properties and direct properties coexist transparently);
 * `alignment` is partial and merges over the style's root alignment to
 * yield the element's effective anchor point and box-edge selection;
 * `classes` are appended to the element's class list, so stylesheets
 * can select on consumer-driven state. Segment-scope classes apply to
 * the main segment subtree only — positioned sibling subtrees (a word
 * pinned at its own anchor) hold their exact spot and must not pick
 * up state-driven styling.
 *
 * `stacking` and `blendMode` say which caption layer the element paints
 * in (see `CaptionLayer`); whatever an element leaves out follows
 * its segment, and whatever a segment leaves out is the base layer —
 * under the top layer, plain. A blend is applied when the layer is
 * composited, not written on the element, which is what makes it hold:
 * `mix-blend-mode` written on an element is cut off by any ancestor
 * that forms a stacking context, and a stylesheet can make any
 * ancestor do that. An element still in its line that paints in
 * another layer than its segment is painted by a copy of the segment's
 * subtree in which only it is visible, laid out exactly as the
 * original; the original hides it.
 */
export interface ScopedRenderOverride {
  readonly inlineStyles?: InlineStyleMap;
  readonly alignment?: Partial<AlignmentConfig>;
  readonly classes?: ReadonlyArray<string>;
  readonly stacking?: CaptionStacking;
  readonly blendMode?: CaptionBlendMode;
}
