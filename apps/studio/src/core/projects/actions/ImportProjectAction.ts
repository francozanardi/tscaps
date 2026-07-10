import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectSerializer, SerializedProject } from '@core/projects/services/ProjectSerializer';

const FILE_KIND = 'tscaps';
const ENVELOPE_VERSION = 1;

interface TscapsFile {
  readonly kind: string;
  readonly exportVersion: number;
  readonly project: SerializedProject;
}

/**
 * Reads a `.tscaps` file and persists its contents as a brand-new Project.
 * The imported project always gets a fresh id and `createdAt` so that
 * re-importing the same file twice produces two visible records — there's
 * no implicit overwrite. The envelope's `kind` and `exportVersion` are
 * validated; the inner project payload is delegated to ProjectSerializer
 * (which enforces the schema version separately).
 *
 * No video Blob is restored — `.tscaps` is a project snapshot, not a media
 * bundle. The dashboard re-select prompt covers the user-facing recovery.
 *
 * Returns the new project's id so the caller can navigate to it.
 */
export class ImportProjectAction {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly serializer: ProjectSerializer,
  ) {}

  async execute(file: File): Promise<string> {
    const text = await file.text();
    const parsed = this.parse(text);
    const reidentified = this.assignFreshIdentity(parsed.project);
    const project = await this.serializer.deserialize(reidentified, null);
    await this.repository.save(project);
    return project.id;
  }

  private parse(text: string): TscapsFile {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('File is not valid JSON.');
    }
    if (!this.isTscapsFile(raw)) {
      throw new Error('File does not look like a tscaps export.');
    }
    if (raw.exportVersion !== ENVELOPE_VERSION) {
      throw new Error(`Unsupported tscaps file version: ${raw.exportVersion}`);
    }
    return raw;
  }

  private isTscapsFile(value: unknown): value is TscapsFile {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.kind === FILE_KIND
      && typeof candidate.exportVersion === 'number'
      && typeof candidate.project === 'object'
      && candidate.project !== null;
  }

  /**
   * Returns a new SerializedProject with regenerated id and timestamps.
   * Sheet ids and document ids are preserved — the `Section.kind` field
   * references sheet ids and breaking that relationship would silently
   * detach all segments from their sheet. Cross-project id collisions are
   * not a concern because each Project owns its own id namespace.
   */
  private assignFreshIdentity(payload: SerializedProject): SerializedProject {
    const now = new Date().toISOString();
    return {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
  }
}
