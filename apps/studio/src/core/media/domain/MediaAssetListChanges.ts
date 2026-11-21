/**
 * Tells when the list of a project's assets may differ from the one
 * last read, for a reason other than an edit made through this page:
 * where the list lives has just come to hold the project, so files it
 * could not answer for before are now its to list.
 */
export interface MediaAssetListChanges {
  /** Calls `listener` with the project whose list should be read again. Returns the unsubscribe. */
  subscribe(listener: (projectId: string) => void): () => void;
}
