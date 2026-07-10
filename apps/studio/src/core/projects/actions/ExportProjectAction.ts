import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectSerializer, SerializedProject } from '@core/projects/services/ProjectSerializer';

const FILE_KIND = 'tscaps';
const ENVELOPE_VERSION = 1;

/**
 * Wire format of an exported `.tscaps` file. The envelope around the
 * serialised project carries an explicit kind and version so a future
 * importer can refuse files that came from incompatible builds.
 */
interface TscapsFile {
  readonly kind: typeof FILE_KIND;
  readonly exportVersion: number;
  readonly project: SerializedProject;
}

/**
 * Packages a Project as a JSON `.tscaps` file and triggers a browser download.
 * The video Blob is intentionally excluded — the exported file is a portable
 * snapshot of the editing work (document, sheets, styles), not a media bundle.
 * Importers will mount the project without a video and prompt the user to
 * re-select the source file.
 */
export class ExportProjectAction {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly serializer: ProjectSerializer,
  ) {}

  async execute(projectId: string): Promise<void> {
    const project = await this.repository.load(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const file: TscapsFile = {
      kind: FILE_KIND,
      exportVersion: ENVELOPE_VERSION,
      project: this.serializer.serialize(project),
    };

    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    this.triggerDownload(blob, this.fileNameFor(project.name));
  }

  private fileNameFor(projectName: string): string {
    const slug = projectName.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-');
    const safe = slug.length > 0 ? slug : 'project';
    return `${safe}.tscaps`;
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
