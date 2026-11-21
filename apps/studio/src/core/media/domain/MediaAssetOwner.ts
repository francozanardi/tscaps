/**
 * Who an asset belongs to, which decides how long it lives.
 *
 * - `project`: one project, which takes it along when it goes.
 * - `library`: the user, across every project; it goes only when
 *   deleted.
 * - `session`: the open project, which has no id and will never be
 *   saved; the asset is held for the page alone.
 */
export type MediaAssetOwner =
  | { readonly kind: 'project'; readonly projectId: string }
  | { readonly kind: 'library' }
  | { readonly kind: 'session' };
