import { BrowserStyleSheetFontFaceReader } from '@core/templates/infrastructure/BrowserStyleSheetFontFaceReader';
import { UnicodeRangeParser } from '@core/templates/services/UnicodeRangeParser';
import { FontFaceCssBuilder } from '@core/templates/services/FontFaceCssBuilder';
import { UserFontRegistrar } from '@core/fonts/services/UserFontRegistrar';
import { UploadUserFontAction } from '@core/fonts/actions/UploadUserFontAction';
import { DeleteUserFontAction } from '@core/fonts/actions/DeleteUserFontAction';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';

export interface FontsDependencies {
  readonly userBlobs: UserBlobsModule;
}

export type FontsModule = Awaited<ReturnType<typeof bootFonts>>;

/**
 * Boots the fonts feature: wires the css-builder that resolves
 * `@font-face` declarations for the export pipeline, attaches the
 * registrar that mirrors the live user-blob store into DOM
 * `@font-face` rules, and exposes the upload / delete actions the
 * settings panel calls. Font persistence is owned by `UserBlobs`;
 * this module composes font-shaped behaviour on top of that backbone.
 */
export async function bootFonts(deps: FontsDependencies) {
  const fontFaceCssReader = new BrowserStyleSheetFontFaceReader();
  const unicodeRangeParser = new UnicodeRangeParser();
  const fontFaceCssBuilder = new FontFaceCssBuilder(fontFaceCssReader, unicodeRangeParser);
  const registrar = new UserFontRegistrar(deps.userBlobs.store, deps.userBlobs.urlResolver);
  registrar.start();
  return {
    fontFaceCssBuilder,
    registrar,
    actions: {
      upload: new UploadUserFontAction(deps.userBlobs.urlResolver, deps.userBlobs.store),
      delete: new DeleteUserFontAction(deps.userBlobs.urlResolver),
    },
  };
}
