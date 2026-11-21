import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { ProjectFileEncoder } from '@core/projects/services/ProjectFileEncoder';

/**
 * Packages a Project as a `.tscaps` file and triggers a browser download.
 * The video Blob is intentionally excluded — the exported file is a portable
 * snapshot of the editing work (document, sheets, styles), not a media bundle.
 * Importers will mount the project without a video and prompt the user to
 * re-select the source file.
 */
export class ExportProjectAction {
  constructor(
    private readonly encoder: ProjectFileEncoder,
    private readonly fileDownloader: FileDownloader,
  ) {}

  async execute(projectId: string): Promise<void> {
    const file = await this.encoder.encode(projectId);
    this.fileDownloader.download(file.blob, file.fileName);
  }
}
