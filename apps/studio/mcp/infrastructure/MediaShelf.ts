import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { SharedFiles } from '@mcp/domain/SharedFiles';

/**
 * Files on disk the page may read, each under an opaque id: the page is
 * handed a URL, never a path, and can read nothing that was not shared
 * with it.
 */
export class MediaShelf implements SharedFiles {
  private readonly byId = new Map<string, string>();

  /** Shares `filePath` and answers the URL path the page reads it from. */
  share(filePath: string): string {
    const id = randomBytes(12).toString('hex');
    this.byId.set(id, filePath);
    return `/automation/media/${id}/${encodeURIComponent(path.basename(filePath))}`;
  }

  /** The file shared under `id`, or null. */
  find(id: string): string | null {
    return this.byId.get(id) ?? null;
  }
}
