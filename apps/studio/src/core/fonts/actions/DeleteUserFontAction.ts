import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';

/**
 * Removes a user-uploaded font end-to-end through the shared user-blob
 * resolver: deletes the persisted record and revokes its object URL.
 * The `@font-face` rule is unregistered reactively when
 * `UserFontRegistrar` observes the store dropping the blob.
 *
 * Anything currently using this font name in a `TypographyConfig`
 * falls back to whatever the browser resolves `font-family: '<name>'`
 * to once the rule is gone — typically the host's default. Cleaning
 * the stored config is intentionally not done here; it would surface
 * as silent edits to the user's project.
 */
export class DeleteUserFontAction {
  constructor(private readonly userBlobUrlResolver: UserBlobUrlResolver) {}

  execute(blobId: string): Promise<void> {
    return this.userBlobUrlResolver.remove(blobId);
  }
}
