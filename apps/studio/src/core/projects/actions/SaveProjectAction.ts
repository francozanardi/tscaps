import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Project } from '@core/projects/domain/Project';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectFromEditorStateBuilder } from '@core/projects/services/ProjectFromEditorStateBuilder';
import type { ProjectSerializer } from '@core/projects/services/ProjectSerializer';

/**
 * Persists the current editor state into the active Project's record.
 * Skips silently if no project is open (state.projectId is null), so the
 * caller does not need to gate the call.
 *
 * If the user edits the project while a save is in flight, the running
 * save still persists the *original* snapshot — the edits remain
 * unsaved (`dirty` stays true) so the next save catches them up.
 *
 * Does not re-cache the video blob — that is owned by CreateProjectAction
 * and never changes for the lifetime of a project.
 */
export class SaveProjectAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
    private readonly projectBuilder: ProjectFromEditorStateBuilder,
    private readonly serializer: ProjectSerializer,
  ) {}

  async execute(): Promise<void> {
    const projectAtStart = this.projectBuilder.build(this.store.snapshot());
    if (!projectAtStart) return;
    const signatureAtStart = this.signatureOf(projectAtStart);
    await this.repository.save(projectAtStart);
    if (this.currentStateMatches(signatureAtStart)) {
      this.store.markClean();
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
