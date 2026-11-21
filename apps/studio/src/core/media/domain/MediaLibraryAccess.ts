/**
 * Whether whoever uses the editor now may keep files in a library, the
 * collection every project of theirs can use. Asked at the moment a
 * file would go there, so it follows a session that begins or ends.
 */
export interface MediaLibraryAccess {
  isOpen(): boolean;
}
