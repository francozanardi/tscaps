/**
 * Descriptive metadata about the source video of a Project.
 *
 * The video Blob itself is cached separately (see ProjectRepository) under an
 * LRU policy, so this type carries only the bits needed to display the
 * project in the dashboard and to recognise a re-selected file.
 */
export interface ProjectVideo {
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly duration: number;
}
