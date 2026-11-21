import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';

/**
 * Builds writers from the usual factory, except while a run redirected
 * to another one is in progress: an export started from outside the
 * editor's own dialog can then send its bytes somewhere other than a
 * browser download, through the same export action. One redirection at
 * a time; a second one waits for the first to end.
 */
export class RedirectableExportWriterFactory implements ExportWriterFactory {
  private redirection: ExportWriterFactory | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly usual: ExportWriterFactory) {}

  create(): ExportWriter {
    return (this.redirection ?? this.usual).create();
  }

  /**
   * Runs `run` with every writer built meanwhile coming from `factory`,
   * and goes back to the usual factory when it settles, whichever way.
   */
  redirectWhile<T>(factory: ExportWriterFactory, run: () => Promise<T>): Promise<T> {
    const turn = this.queue.then(async () => {
      this.redirection = factory;
      try {
        return await run();
      } finally {
        this.redirection = null;
      }
    });
    this.queue = turn.catch(() => undefined);
    return turn;
  }
}
