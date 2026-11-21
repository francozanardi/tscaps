/**
 * The realm of the local surface — and of every record written before
 * records named one, since those could have come from anywhere and
 * this is the realm whose records are never sent anywhere.
 */
export const LOCAL_MEDIA_ASSET_REALM = 'local';

/**
 * Whose records of assets on this device are read and written now.
 *
 * One browser keeps one database for every surface and every person
 * using it, so each record of an asset is stamped with the realm it was
 * written in, and a reader lists, moves and sends only what belongs to
 * its own. A realm is an opaque string; only the implementations know
 * what one names.
 */
export interface MediaAssetRealm {
  /** The realm a record written now is stamped with. */
  current(): string;
  /** Whether a record stamped `realm` belongs to whoever reads now. */
  includes(realm: string): boolean;
}
