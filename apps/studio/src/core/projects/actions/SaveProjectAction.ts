import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Project } from '@core/projects/domain/Project';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectFromEditorStateBuilder } from '@core/projects/services/ProjectFromEditorStateBuilder';
import type { ProjectSerializer } from '@core/projects/services/ProjectSerializer';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';

/**
 * Persists an editor state into its Project's record: by default the
 * state the editor shows now, or an earlier one handed in, such as the
 * last state of a session the editor has since left. Skips silently if
 * that state has no project (state.projectId is null), so the caller
 * does not need to gate the call.
 *
 * Also skips when the payload would be byte-for-byte what the last
 * successful save already wrote, so a caller that saves on every pass
 * costs nothing when there is nothing to write. The comparison is on
 * content rather than on the `dirty` flag because state reaches the
 * store through paths that never raise it, and a save that skipped one
 * of those would drop work.
 *
 * The editor is marked clean only when what was saved is what it shows
 * once the save is over. If the user edits the project while a save is
 * in flight, the running save still persists the *original* snapshot —
 * the edits remain unsaved (`dirty` stays true) so the next save
 * catches them up.
 *
 * Does not re-cache the video blob — that is owned by CreateProjectAction
 * and never changes for the lifetime of a project.
 *
 * Every failure leaves as a `ProjectSaveFailedError` carrying the
 * original error in `cause`, so callers report a failed save without
 * inspecting whatever the storage layer threw.
 */
export class SaveProjectAction {
  private lastWrittenSignature: string | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
    private readonly projectBuilder: ProjectFromEditorStateBuilder,
    private readonly serializer: ProjectSerializer,
  ) {}

  async execute(state: EditorState = this.store.snapshot()): Promise<void> {
    const projectAtStart = this.projectBuilder.build(state);
    if (!projectAtStart) return;
    const signatureAtStart = this.signatureOf(projectAtStart);
    // When storage already holds this exact content, the state is as
    // saved as a write would leave it.
    if (signatureAtStart !== this.lastWrittenSignature) {
      await this.write(projectAtStart);
      this.lastWrittenSignature = signatureAtStart;
    }
    if (this.currentStateMatches(signatureAtStart)) {
      this.store.markClean();
    }
  }

  private async write(project: Project): Promise<void> {
    try {
      await this.repository.save(project);
    } catch (cause) {
      throw new ProjectSaveFailedError({ cause });
    }
  }

  private currentStateMatches(signatureAtStart: string): boolean {
    const projectAtEnd = this.projectBuilder.build(this.store.snapshot());
    if (!projectAtEnd) return false;
    return this.signatureOf(projectAtEnd) === signatureAtStart;
  }

  private signatureOf(project: Project): string {
    const serialized = this.serializer.serialize(project) as unknown as Record<string, unknown>;
    // `updatedAt` is stamped at build time, so two builds of the same
    // editor state always differ here. Strip it before signing so the
    // signature reflects content, not the moment of serialization.
    const content: Record<string, unknown> = { ...serialized };
    delete content.updatedAt;
    return JSON.stringify(content);
  }
}
