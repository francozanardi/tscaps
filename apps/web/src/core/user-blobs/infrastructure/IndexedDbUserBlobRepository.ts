import type { IndexedDbClient } from '@core/_shared/persistence/IndexedDbClient';
import type { UserBlob, UserBlobFontFormat } from '@core/user-blobs/domain/UserBlob';
import type { UserBlobPutInput, UserBlobRepository } from '@core/user-blobs/domain/UserBlobRepository';

const STORE = 'user-blobs';

const VALID_FONT_FORMATS: ReadonlySet<UserBlobFontFormat> = new Set([
  'woff2',
  'woff',
  'truetype',
  'opentype',
]);

/**
 * Browser-side `UserBlobRepository`. Persists every uploaded blob on
 * the shared IndexedDB connection under the `user-blobs` store, with
 * the blob id as keyPath. The id is generated on `put`.
 *
 * The stored record carries the full discriminated `UserBlob` shape
 * — including font-specific `family` / `format` when present — so
 * `list()` returns it back as a typed union. Records that fail the
 * shape check are dropped with a console warning so a single
 * corrupted or out-of-date entry cannot tear the whole library down
 * at boot.
 */
export class IndexedDbUserBlobRepository implements UserBlobRepository {

  constructor(private readonly db: IndexedDbClient) {}

  async list(): Promise<UserBlob[]> {
    const records = await this.db.readAll<unknown>(STORE);
    return records.flatMap((record) => this.acceptValidRecord(record));
  }

  async put(input: UserBlobPutInput): Promise<UserBlob> {
    const stored = this.buildStoredBlob(input);
    await this.db.writeOne(STORE, stored);
    return stored;
  }

  delete(id: string): Promise<void> {
    return this.db.deleteOne(STORE, id);
  }

  private acceptValidRecord(record: unknown): UserBlob[] {
    if (this.isUserBlob(record)) return [record];
    console.warn('[user-blobs] dropping malformed record:', record);
    return [];
  }

  private isUserBlob(record: unknown): record is UserBlob {
    if (record === null || typeof record !== 'object') return false;
    const candidate = record as Record<string, unknown>;
    if (typeof candidate.id !== 'string') return false;
    if (typeof candidate.mimeType !== 'string') return false;
    if (!(candidate.blob instanceof Blob)) return false;
    if (candidate.kind === 'template-asset') return true;
    if (candidate.kind === 'font') return this.hasValidFontFields(candidate);
    return false;
  }

  private hasValidFontFields(candidate: Record<string, unknown>): boolean {
    if (typeof candidate.family !== 'string') return false;
    if (typeof candidate.format !== 'string') return false;
    return VALID_FONT_FORMATS.has(candidate.format as UserBlobFontFormat);
  }

  private buildStoredBlob(input: UserBlobPutInput): UserBlob {
    const id = crypto.randomUUID();
    if (input.kind === 'font') {
      return {
        id,
        kind: input.kind,
        mimeType: input.mimeType,
        blob: input.blob,
        family: input.family,
        format: input.format,
      };
    }
    return {
      id,
      kind: input.kind,
      mimeType: input.mimeType,
      blob: input.blob,
    };
  }
}
