import { describe, expect, it } from 'vitest';
import { OpfsEncodedFileStagingSweeper, type StagingDirectory } from '@core/_shared/opfs/OpfsEncodedFileStagingSweeper';

/**
 * A proxy is handed out as a `File` read from its staging file, and a
 * private window's IndexedDB keeps only a reference to it. A second
 * proxy made in the same page used to sweep the first one's file away,
 * leaving every reader of the first with a file that no longer reads.
 */

class InMemoryStagingDirectory implements StagingDirectory {
  readonly names = new Set<string>();

  async *entries(): AsyncIterableIterator<[string, unknown]> {
    for (const name of [...this.names]) yield [name, null];
  }

  removeEntry(name: string): Promise<void> {
    this.names.delete(name);
    return Promise.resolve();
  }
}

const PREFIX = 'preview-proxy-';

describe('sweeping staged proxies', () => {
  it('removes what earlier page loads left behind, and nothing else', async () => {
    const directory = new InMemoryStagingDirectory();
    directory.names.add(`${PREFIX}left-behind.mp4`);
    directory.names.add('export-unrelated.mp4');

    await new OpfsEncodedFileStagingSweeper(() => Promise.resolve(directory), PREFIX).sweepLeftovers();

    expect([...directory.names]).toEqual(['export-unrelated.mp4']);
  });

  it('never removes a proxy this page staged, however many runs come after it', async () => {
    const directory = new InMemoryStagingDirectory();
    const sweeper = new OpfsEncodedFileStagingSweeper(() => Promise.resolve(directory), PREFIX);
    await sweeper.sweepLeftovers();
    directory.names.add(`${PREFIX}first-run.mp4`);

    await sweeper.sweepLeftovers();

    expect(directory.names.has(`${PREFIX}first-run.mp4`)).toBe(true);
  });
});
