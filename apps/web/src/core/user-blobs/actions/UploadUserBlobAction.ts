// banned-words-allow-file: quota
import type { UserBlob } from '@core/user-blobs/domain/UserBlob';
import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';
import { UserBlobInvalidUploadError } from '@core/user-blobs/domain/UserBlobInvalidUploadError';
import { UserBlobQuotaExceededError } from '@core/user-blobs/domain/UserBlobQuotaExceededError';

// 200 KB. The bytes are base64-encoded into the export SVG, so this
// cap doubles as a payload guard.
const MAX_BYTES = 200 * 1024;

export type UploadUserBlobFailure =
  | { kind: 'unsupported-format'; mimeType: string }
  | { kind: 'too-large'; size: number; max: number }
  | { kind: 'quota-exceeded'; current: number; limit: number }
  | { kind: 'invalid-upload'; reason: string }
  | { kind: 'upload-failed'; reason: string };

export type UploadUserBlobResult =
  | { ok: true; blob: UserBlob }
  | { ok: false; failure: UploadUserBlobFailure };

/**
 * Persists a user-supplied image as a `template-asset` user blob and
 * returns the stored record. Pure asset write — does not touch any
 * sheet's style values, so callers can stage an upload first and
 * decide whether (and where) to use it afterwards.
 *
 * Failures are returned as data rather than thrown so the caller can
 * render a user-facing message. Typed domain errors thrown by the
 * repository map onto the matching failure kinds; any other error
 * collapses onto `upload-failed`.
 */
export class UploadUserBlobAction {
  constructor(private readonly userBlobUrlResolver: UserBlobUrlResolver) {}

  async execute(file: File): Promise<UploadUserBlobResult> {
    const validation = this.validateLocally(file);
    if (validation !== null) return { ok: false, failure: validation };
    try {
      const stored = await this.userBlobUrlResolver.add({
        kind: 'template-asset',
        blob: file,
        mimeType: file.type,
      });
      return { ok: true, blob: stored };
    } catch (err) {
      return { ok: false, failure: this.classifyRepositoryError(err) };
    }
  }

  private validateLocally(file: File): UploadUserBlobFailure | null {
    if (!file.type.startsWith('image/')) {
      return { kind: 'unsupported-format', mimeType: file.type };
    }
    if (file.size > MAX_BYTES) {
      return { kind: 'too-large', size: file.size, max: MAX_BYTES };
    }
    return null;
  }

  private classifyRepositoryError(err: unknown): UploadUserBlobFailure {
    if (err instanceof UserBlobQuotaExceededError) {
      return { kind: 'quota-exceeded', current: err.current, limit: err.limit };
    }
    if (err instanceof UserBlobInvalidUploadError) {
      return { kind: 'invalid-upload', reason: err.reason };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'upload-failed', reason: message };
  }
}
