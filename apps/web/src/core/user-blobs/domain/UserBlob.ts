/**
 * A binary asset the user uploaded — template-asset image overrides
 * or uploaded fonts. `kind` discriminates the consumer; the per-kind
 * union narrows the metadata each consumer is allowed to carry.
 *
 * `id` is opaque and stable across sessions; consumers persist it
 * inside sheet style values or font-family references and resolve to
 * a runtime URL via `UserBlobUrlResolver`.
 */
export type UserBlobKind = 'template-asset' | 'font';

export type UserBlobFontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype';

interface UserBlobBase {
  readonly id: string;
  readonly mimeType: string;
  readonly blob: Blob;
}

export interface TemplateAssetUserBlob extends UserBlobBase {
  readonly kind: 'template-asset';
}

export interface FontUserBlob extends UserBlobBase {
  readonly kind: 'font';
  readonly family: string;
  readonly format: UserBlobFontFormat;
}

export type UserBlob = TemplateAssetUserBlob | FontUserBlob;
