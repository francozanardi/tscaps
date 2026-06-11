// banned-words-allow-file: quota
import type { FontUserBlob, UserBlobFontFormat } from '@core/user-blobs/domain/UserBlob';
import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';
import type { UserBlobsStore } from '@core/user-blobs/store/UserBlobsStore';
import { UserBlobDuplicateFamilyError } from '@core/user-blobs/domain/UserBlobDuplicateFamilyError';
import { UserBlobInvalidUploadError } from '@core/user-blobs/domain/UserBlobInvalidUploadError';
import { UserBlobQuotaExceededError } from '@core/user-blobs/domain/UserBlobQuotaExceededError';

const MAX_BYTES = 5 * 1024 * 1024;

const FORMAT_BY_EXT: Readonly<Record<string, UserBlobFontFormat>> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

export type UploadUserFontFailure =
  | { kind: 'unsupported-format'; extension: string }
  | { kind: 'too-large'; size: number; max: number }
  | { kind: 'duplicate-name'; family: string }
  | { kind: 'empty-name' }
  | { kind: 'quota-exceeded'; current: number; limit: number }
  | { kind: 'invalid-upload'; reason: string }
  | { kind: 'upload-failed'; reason: string };

export type UploadUserFontResult =
  | { ok: true; font: FontUserBlob }
  | { ok: false; failure: UploadUserFontFailure };

/**
 * Adds a user-uploaded font as a `'font'`-kind user blob: derives the
 * family from the filename, validates format / size / local
 * uniqueness, then persists through the shared user-blob resolver.
 * DOM `@font-face` injection is reactive and handled elsewhere by
 * `UserFontRegistrar` — this action does not touch the document.
 *
 * The family name is the filename without extension, lightly
 * sanitised: single-quotes are stripped (they would terminate the
 * `font-family: '...'` declaration the registrar emits) and
 * surrounding whitespace trimmed. The user is expected to rename
 * the file before upload if they want a cleaner display name.
 */
export class UploadUserFontAction {
  constructor(
    private readonly userBlobUrlResolver: UserBlobUrlResolver,
    private readonly store: UserBlobsStore,
  ) {}

  async execute(file: File): Promise<UploadUserFontResult> {
    const local = this.validateLocally(file);
    if (local.kind === 'failure') return { ok: false, failure: local.failure };

    try {
      const stored = await this.userBlobUrlResolver.add({
        kind: 'font',
        blob: file,
        mimeType: file.type || `font/${local.format}`,
        family: local.family,
        format: local.format,
      });
      if (stored.kind !== 'font') {
        return { ok: false, failure: { kind: 'upload-failed', reason: 'Stored blob kind drifted from font.' } };
      }
      return { ok: true, font: stored };
    } catch (err) {
      return { ok: false, failure: this.classifyRemoteError(err) };
    }
  }

  private validateLocally(
    file: File,
  ):
    | { kind: 'ok'; family: string; format: UserBlobFontFormat }
    | { kind: 'failure'; failure: UploadUserFontFailure } {
    const extension = file.name.toLowerCase().split('.').pop() ?? '';
    const format = FORMAT_BY_EXT[extension];
    if (!format) {
      return { kind: 'failure', failure: { kind: 'unsupported-format', extension } };
    }
    if (file.size > MAX_BYTES) {
      return { kind: 'failure', failure: { kind: 'too-large', size: file.size, max: MAX_BYTES } };
    }
    const family = this.deriveFamily(file.name);
    if (family.length === 0) {
      return { kind: 'failure', failure: { kind: 'empty-name' } };
    }
    if (this.familyAlreadyTaken(family)) {
      return { kind: 'failure', failure: { kind: 'duplicate-name', family } };
    }
    return { kind: 'ok', family, format };
  }

  private deriveFamily(filename: string): string {
    const dot = filename.lastIndexOf('.');
    const base = dot === -1 ? filename : filename.slice(0, dot);
    return base.replace(/'/g, '').trim();
  }

  private familyAlreadyTaken(family: string): boolean {
    return this.store.snapshot().some((b) => b.kind === 'font' && b.family === family);
  }

  private classifyRemoteError(err: unknown): UploadUserFontFailure {
    if (err instanceof UserBlobQuotaExceededError) {
      return { kind: 'quota-exceeded', current: err.current, limit: err.limit };
    }
    if (err instanceof UserBlobDuplicateFamilyError) {
      return { kind: 'duplicate-name', family: err.family };
    }
    if (err instanceof UserBlobInvalidUploadError) {
      return { kind: 'invalid-upload', reason: err.reason };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'upload-failed', reason: message };
  }
}
