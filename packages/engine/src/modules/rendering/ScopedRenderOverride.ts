import type { AlignmentConfig } from '@modules/rendering/AlignmentConfig';
import type { InlineStyleMap } from '@modules/rendering/InlineStyleMap';

/**
 * Render-time overrides for one element (segment or word), layered on
 * top of the style's root-level defaults. Both fields are independent
 * and optional: a scope may override inline styles only, alignment
 * only, or both. An entry where both are absent is equivalent to the
 * absence of the entry and should be omitted by builders.
 *
 * `inlineStyles` lands on the element's `style="..."` attribute (CSS
 * custom properties and direct properties coexist transparently);
 * `alignment` is partial and merges over the style's root alignment to
 * yield the element's effective anchor point and box-edge selection.
 */
export interface ScopedRenderOverride {
  readonly inlineStyles?: InlineStyleMap;
  readonly alignment?: Partial<AlignmentConfig>;
}
