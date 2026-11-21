/**
 * A per-project store whose entries live only as long as their
 * project's source video stays on this device. It keeps no eviction
 * order of its own: the video cache decides which projects are
 * resident, and tells it.
 *
 * Letting a project go is two operations. **Eviction** frees room: the
 * project still exists, so a store may spare what this device could
 * not get back from anywhere else. **Deletion** is the project ending:
 * everything held for it goes.
 */
export interface ProjectDependentStore {
  /** Drops whatever is held for `projectId`, the project having ended. */
  deleteProject(projectId: string): Promise<void>;
  /** Drops what is held for `projectId` to free room, sparing anything whose only copy is here. */
  evictProject(projectId: string): Promise<void>;
  /** Evicts whatever is held for a project outside `projectIds`. */
  retainOnly(projectIds: ReadonlySet<string>): Promise<void>;
}
