
/**
 * What stands in front of a library the reader cannot use: the gate's
 * words, and where it leads from each place it stands. Each place is a
 * call to action of its own, so a sign-up is credited to the one followed.
 */
export interface MediaLibraryGate {
  /** The whole sentence, for where there is room for it and for assistive tech. */
  readonly label: string;
  /** The same way through in a word or two, for a row that has no room for the sentence. */
  readonly actionLabel: string;
  /** The sign-up, from the bin's *Library* scope. */
  readonly libraryHref: string;
  /** The sign-up, from *Save to library* in a file's menu. */
  readonly saveToLibraryHref: string;
}

/**
 * The gate in front of the media library, or null when the reader can
 * use it. Re-renders when that changes.
 */
export function useMediaLibraryGate(): MediaLibraryGate | null {
  return null;
}
