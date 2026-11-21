const NO_LABEL = (): string | null => null;

/**
 * What a file's tile says when the file is about to be deleted for not
 * being used, by file id: null for a file that is not. Changes when the
 * listing does, not as time passes.
 */
export function useLibraryFileExpiryLabels(): (fileId: string) => string | null {
  return NO_LABEL;
}
