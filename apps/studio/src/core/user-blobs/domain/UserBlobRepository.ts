import type { UserBlob, UserBlobFontFormat } from '@core/user-blobs/domain/UserBlob';

interface UserBlobPutInputBase {
  readonly blob: Blob;
  readonly mimeType: string;
}

export interface TemplateAssetPutInput extends UserBlobPutInputBase {
  readonly kind: 'template-asset';
}

export interface FontPutInput extends UserBlobPutInputBase {
  readonly kind: 'font';
  readonly family: string;
  readonly format: UserBlobFontFormat;
}

export type UserBlobPutInput = TemplateAssetPutInput | FontPutInput;

/**
 * Persistence boundary for the user's uploaded binary assets. The
 * implementation owns where the bytes live and allocates the id during
 * `put`; callers trade only opaque ids.
 */
export interface UserBlobRepository {
  list(): Promise<UserBlob[]>;
  put(input: UserBlobPutInput): Promise<UserBlob>;
  delete(id: string): Promise<void>;
}
