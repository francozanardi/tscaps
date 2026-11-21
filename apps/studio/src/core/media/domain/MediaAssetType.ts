/**
 * What kind of file an asset is, which decides how it is read, made
 * ready and played. What it is used for — a b-roll, a picture on top, a
 * sound — is not part of it: that is decided by whatever uses it. The
 * matching value lives on the server too; keep both in sync.
 */
export const MEDIA_ASSET_TYPES = ['video', 'image', 'gif', 'audio'] as const;

export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];
