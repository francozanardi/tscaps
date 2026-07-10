import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';

/**
 * Removes a user blob from persistent storage and revokes its
 * cached object URL. Does not touch sheet style values — a sheet
 * that still references the deleted blob silently falls back to the
 * template's bundled default the next time the CSS is composed.
 *
 * Callers that want to warn the user before destroying an in-use
 * blob should look up usage and present the confirmation themselves.
 */
export class DeleteUserBlobAction {
  constructor(private readonly userBlobUrlResolver: UserBlobUrlResolver) {}

  execute(blobId: string): Promise<void> {
    return this.userBlobUrlResolver.remove(blobId);
  }
}
