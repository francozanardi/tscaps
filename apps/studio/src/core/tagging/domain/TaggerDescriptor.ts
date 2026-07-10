import type { Document } from '@tscaps/engine';
import type { TagName } from '@core/tagging/domain/TagName';

/**
 * Where the tagger's tags get attached.
 *
 * - `'client'` — applied by `apply()` when the registry runs.
 * - `'remote'` — already attached on the incoming document; `apply()`
 *   is a passthrough.
 */
export type TaggerAppliedBy = 'client' | 'remote';

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
