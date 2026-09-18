import type { Document } from '@tscaps/engine';
import type { TagName } from '@core/tagging/domain/TagName';

/**
 * Where the tagger's tags get attached.
 *
 * - `'client'` — applied by `apply()` when the registry runs.
 * - `'remote'` — already attached on the incoming document; `apply()`
 *   is a passthrough.
 * - `'on-demand'` — applied by `apply()`, but only when a feature asks
 *   for this tagger by name. A registry-wide run skips it, and nothing
 *   requests it upstream, so its tags exist only after a deliberate
 *   call.
 */
export type TaggerAppliedBy = 'client' | 'remote' | 'on-demand';

/**
 * One platform tagger: stable id, the canonical tag name it emits,
 * where it is applied, and a transform that returns the document
 * with this tagger's tags merged in. Stateless and reused across
 * runs. User-facing label and description for the emitted tag live
 * in `TAG_METADATA` keyed by `tagName`.
 */
export interface TaggerDescriptor {
  readonly id: string;
  readonly tagName: TagName;
  readonly appliedBy: TaggerAppliedBy;
  apply(document: Document): Promise<Document>;
}
