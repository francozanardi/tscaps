/**
 * Raised by every request to a database that a newer version of the
 * app has upgraded past the version this page's code was built for.
 *
 * Nothing this page does can reach the database again: it asks for
 * the version it knows, and the browser refuses a version lower than
 * the one already stored. Only loading the page again helps, because
 * that runs the newer code, which knows the upgraded database.
 *
 * `cause` carries what the browser raised when there was something,
 * such as its own `VersionError`.
 */
export class IndexedDbSupersededError extends Error {
  static readonly ERROR_NAME = 'IndexedDbSupersededError';

  constructor(dbName: string, knownVersion: number, options?: { cause?: unknown }) {
    super(
      `IndexedDB "${dbName}" was upgraded past version ${knownVersion} by a newer version of this app. ` +
      'Reload the page to run code that knows the upgraded database.',
      options,
    );
    this.name = IndexedDbSupersededError.ERROR_NAME;
  }
}
