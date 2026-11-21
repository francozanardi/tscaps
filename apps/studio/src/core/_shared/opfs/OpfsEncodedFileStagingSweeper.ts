import type { EncodedFileStagingSweeper } from '@core/_shared/domain/EncodedFileStagingSweeper';

/** The part of an OPFS directory the sweep needs. */
export interface StagingDirectory {
  entries(): AsyncIterableIterator<[string, unknown]>;
  removeEntry(name: string): Promise<void>;
}

/**
 * {@link EncodedFileStagingSweeper} over the origin's private file
 * system: removes the files named with `prefix` that are there when
 * the page first asks, once.
 *
 * Once, because every file staged after that was staged by this page,
 * and a run that fails or is given up removes its own; a sweep per run
 * removed the file behind every one handed out before it.
 */
export class OpfsEncodedFileStagingSweeper implements EncodedFileStagingSweeper {
  private sweep: Promise<void> | null = null;

  constructor(
    private readonly directory: () => Promise<StagingDirectory>,
    private readonly prefix: string,
  ) {}

  sweepLeftovers(): Promise<void> {
    this.sweep ??= this.removeLeftovers();
    return this.sweep;
  }

  private async removeLeftovers(): Promise<void> {
    try {
      const root = await this.directory();
      const removals: Promise<void>[] = [];
      for await (const [name] of root.entries()) {
        if (name.startsWith(this.prefix)) removals.push(root.removeEntry(name).catch(() => undefined));
      }
      await Promise.all(removals);
    } catch {
      // Best-effort: leftovers take up space but don't block a new run.
    }
  }
}
