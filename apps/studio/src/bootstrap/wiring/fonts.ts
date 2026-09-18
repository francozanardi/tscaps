import { UserFontRegistrar } from '@core/fonts/services/UserFontRegistrar';
import { UploadUserFontAction } from '@core/fonts/actions/UploadUserFontAction';
import { DeleteUserFontAction } from '@core/fonts/actions/DeleteUserFontAction';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';

export interface FontsDependencies {
  readonly userBlobs: UserBlobsModule;
}

export type FontsModule = Awaited<ReturnType<typeof bootFonts>>;

/**
 * Boots the user-uploaded fonts feature: attaches the registrar that
 * mirrors the live user-blob store into DOM `@font-face` rules, and
 * exposes the upload / delete actions the settings panel calls. Font
 * persistence is owned by `UserBlobs`; this module composes
 * font-shaped behaviour on top of that backbone.
 *
 * The rules a rendered caption is written with are not here: they are
 * read back off the page these ones are registered into, which makes
 * them part of painting a sheet.
 */
export async function bootFonts(deps: FontsDependencies) {
  const registrar = new UserFontRegistrar(deps.userBlobs.store, deps.userBlobs.urlResolver);
  registrar.start();
  return {
    registrar,
    actions: {
      upload: new UploadUserFontAction(deps.userBlobs.urlResolver, deps.userBlobs.store),
      delete: new DeleteUserFontAction(deps.userBlobs.urlResolver),
    },
  };
}
