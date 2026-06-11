import type { ExportWriter } from '@core/editor/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/editor/domain/ExportWriterFactory';
import type { UserAgentInspector } from '@core/_shared/UserAgentInspector';
import { FilePickerExportWriter } from '@core/editor/infrastructure/FilePickerExportWriter';
import { OpfsExportWriter } from '@core/editor/infrastructure/OpfsExportWriter';
import { MemoryExportWriter } from '@core/editor/infrastructure/MemoryExportWriter';

/**
 * Picks the best available {@link ExportWriter} for the current runtime
 * by asking each candidate's static `isSupported`. Only the chosen
 * writer is instantiated — the others are never constructed, so a
 * writer's constructor side effects (worker spawn, file handles) never
 * fire on environments that would not have used it anyway.
 *
 * Preference order: a streaming file picker (desktop Chromium), then
 * OPFS + `<a download>` (mobile Chromium, Firefox, Safari), then an
 * in-memory buffer (always available).
 *
 * Mobile is steered away from the file picker even when supported: on
 * Android, `showSaveFilePicker` launches a system intent that
 * backgrounds the tab, and the OOM killer routinely terminates
 * memory-pressured tabs while that intent is in front. The OPFS path
 * keeps the tab in the foreground and downloads the finished file via
 * an anchor.
 */
export class DefaultExportWriterFactory implements ExportWriterFactory {

  constructor(private readonly userAgentInspector: UserAgentInspector) {}

  create(): ExportWriter {
    if (!this.userAgentInspector.isMobile() && FilePickerExportWriter.isSupported()) {
      return new FilePickerExportWriter();
    }
    if (OpfsExportWriter.isSupported()) {
      const worker = new Worker(
        new URL('./workers/opfsWriterWorker.ts', import.meta.url),
        { type: 'module' },
      );
      return new OpfsExportWriter(worker);
    }
    return new MemoryExportWriter();
  }
}
