/**
 * Why a file was not added to the library or moved there: whoever uses
 * the editor now has no library to keep it in. Travels as the `cause`
 * of the import or move failure.
 */
export class MediaLibraryUnavailableError extends Error {
  readonly name = 'MediaLibraryUnavailableError';

  constructor() {
    super('The media library is not open to whoever uses the editor now');
  }
}
