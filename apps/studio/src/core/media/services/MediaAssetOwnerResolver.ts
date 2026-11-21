import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaLibraryAccess } from '@core/media/domain/MediaLibraryAccess';
import { MediaLibraryUnavailableError } from '@core/media/domain/errors/MediaLibraryUnavailableError';

/** Where a file is added or moved to: the open project, or the user's library. */
export type MediaAssetDestination = 'project' | 'library';

/**
 * Turns where a file goes into who owns it. The open project owns it
 * when the project has an id; one that has none — a session that is
 * never saved — holds it for the page. The library owns it only while
 * the library is open to whoever uses the editor now.
 */
export class MediaAssetOwnerResolver {
  constructor(private readonly library: MediaLibraryAccess) {}

  /**
   * Throws {@link MediaLibraryUnavailableError} for the library while it
   * is not open: every add and move asks here, so no path puts a file
   * there that this refuses.
   */
  ownerFor(destination: MediaAssetDestination, openProjectId: string | null): MediaAssetOwner {
    if (destination === 'library') {
      if (!this.library.isOpen()) throw new MediaLibraryUnavailableError();
      return { kind: 'library' };
    }
    return openProjectId === null ? { kind: 'session' } : { kind: 'project', projectId: openProjectId };
  }

  /** Whether `a` and `b` name the same owner. */
  same(a: MediaAssetOwner, b: MediaAssetOwner): boolean {
    if (a.kind === 'project' && b.kind === 'project') return a.projectId === b.projectId;
    return a.kind === b.kind;
  }
}
