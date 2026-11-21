import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { ExportFileTargets } from '@core/automation/domain/ExportFileTarget';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import type { RedirectableExportWriterFactory } from '@core/export/services/RedirectableExportWriterFactory';

const PARAMS = z.object({
  file: z.string().min(1),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  quality: z.enum(['low', 'medium', 'high', 'very-high']).default('high'),
  resolution: z.union([z.literal('original'), z.object({ width: z.number().int().min(16), height: z.number().int().min(16) })]).default('original'),
  audio: z.enum(['keep', 'discard']).default('keep'),
});

/**
 * `export_video`: runs the editor's own export, the progress showing in
 * the page as it does for the person, with the encoded bytes sent to the
 * file the program named instead of a download. Resolves when the file
 * is written, with its size; rejects when the export failed or was
 * cancelled, with the editor's error when there is one.
 */
export class ExportVideoMethod implements AutomationMethod {
  readonly name = 'export_video';

  constructor(
    private readonly store: EditorStore,
    private readonly exportVideo: ExportVideoAction,
    private readonly writers: RedirectableExportWriterFactory,
    private readonly targets: ExportFileTargets,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { file, format, quality, resolution, audio } = this.params.read(this.name, PARAMS, params);
    if (this.store.snapshot().status !== 'ready') throw new AutomationCallFailedError(this.name, 'no project is ready to export');
    const target = this.targets.targetFor(file);
    await this.writers.redirectWhile(target, () => this.exportVideo.execute({ format, quality, resolution, audio }));
    const outcome = target.outcome();
    if (outcome.kind === 'written') return { file, bytes: outcome.bytes, format };
    const { error } = this.store.snapshot();
    throw new AutomationCallFailedError(this.name, outcome.kind === 'not-started' ? 'the export did not start' : 'the export did not finish', error === null ? undefined : { cause: error });
  }
}
