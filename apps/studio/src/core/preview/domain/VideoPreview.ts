/**
 * Why the preview is playing the original bytes instead of a proxy.
 * Each value carries its own user-facing copy, so they are not
 * interchangeable.
 *
 * - `pipeline-disabled` — the session never produces proxies.
 * - `policy-skipped` — never started; the source alone ruled it out.
 * - `generation-abandoned` — ran past its time budget and was stopped.
 * - `none-stored` — the project has no proxy saved, and opening one
 *   does not build it.
 * - `generation-failed` — ran and threw.
 * - `converted-source` — never started: the source was converted in
 *   the browser into a file any browser plays, at the cost of most of
 *   a proxy's own encode, so the conversion plays as it is.
 */
export type OriginalPreviewReason =
  | 'pipeline-disabled'
  | 'policy-skipped'
  | 'generation-abandoned'
  | 'none-stored'
  | 'generation-failed'
  | 'converted-source';

/**
 * The blob the preview surface loads, and what it is. Kept as one
 * value so the two cannot be written apart: consumers that describe
 * the preview to the user read them together.
 */
export type VideoPreview =
  | { readonly kind: 'proxy'; readonly file: Blob }
  | { readonly kind: 'original'; readonly file: Blob; readonly reason: OriginalPreviewReason };

/**
 * Reasons where generating on demand is still worth offering: the
 * source was decodable and nothing broke. A disabled pipeline has
 * nothing to offer, and a failed encode already carries its own
 * notice.
 */
export const REASONS_WORTH_OFFERING_GENERATION: ReadonlySet<OriginalPreviewReason> = new Set([
  'policy-skipped',
  'generation-abandoned',
  'none-stored',
  'converted-source',
]);
