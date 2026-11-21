import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { ProjectFileEncoder } from '@core/projects/services/ProjectFileEncoder';

const PARAMS = z.object({ file: z.string().min(1) });

/**
 * `save_project`: saves the open project in the browser, as the editor
 * does, and writes it as a `.tscaps` file to the file the program
 * named. Answers the project's id, the file name it suggests and the
 * size written.
 */
export class SaveProjectMethod implements AutomationMethod {
  readonly name = 'save_project';

  constructor(
    private readonly store: EditorStore,
    private readonly save: SaveProjectAction,
    private readonly encoder: ProjectFileEncoder,
    private readonly channel: AutomationChannel,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { file } = this.params.read(this.name, PARAMS, params);
    const { projectId } = this.store.snapshot();
    if (projectId === null) throw new AutomationCallFailedError(this.name, 'no project is open');
    await this.save.execute();
    const encoded = await this.encoder.encode(projectId);
    const bytes = new Uint8Array(await encoded.blob.arrayBuffer());
    await this.channel.writeFile(file, 0, bytes);
    return { projectId, fileName: encoded.fileName, bytes: bytes.byteLength };
  }
}
