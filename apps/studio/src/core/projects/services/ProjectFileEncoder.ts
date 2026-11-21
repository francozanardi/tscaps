import { ProjectNotFoundError } from '@core/projects/domain/errors/ProjectNotFoundError';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectSerializer, SerializedProject } from '@core/projects/services/ProjectSerializer';

const FILE_KIND = 'tscaps';
const ENVELOPE_VERSION = 1;

/**
 * Wire format of a `.tscaps` file. The envelope around the serialised
 * project carries an explicit kind and version so a future importer can
 * refuse files that came from incompatible builds.
 */
interface TscapsFile {
  readonly kind: typeof FILE_KIND;
  readonly exportVersion: number;
  readonly project: SerializedProject;
}

/** A stored project written as a `.tscaps` file, and the name it suggests. */
export interface EncodedProjectFile {
  readonly blob: Blob;
  readonly fileName: string;
}

/**
 * Writes a stored project as a `.tscaps` file: JSON, without the video,
 * since the file is a portable snapshot of the editing work (document,
 * sheets, styles), not a media bundle. Reads the project as last saved.
 */
export class ProjectFileEncoder {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly serializer: ProjectSerializer,
  ) {}

  /** Rejects with `ProjectNotFoundError` when no project is stored under `projectId`. */
  async encode(projectId: string): Promise<EncodedProjectFile> {
    const project = await this.repository.load(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    const file: TscapsFile = {
      kind: FILE_KIND,
      exportVersion: ENVELOPE_VERSION,
      project: this.serializer.serialize(project),
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    return { blob, fileName: this.fileNameFor(project.name) };
  }

  private fileNameFor(projectName: string): string {
    const slug = projectName.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-');
    const safe = slug.length > 0 ? slug : 'project';
    return `${safe}.tscaps`;
  }
}
