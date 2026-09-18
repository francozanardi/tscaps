import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';

interface HeldVideo {
  readonly projectId: string;
  readonly blob: Blob;
}

/**
 * `VideoBlobCache` that keeps the bytes of the one project the durable
 * cache could not keep, in front of it, and answers from memory only
 * for that project.
 *
 * What this buys is a device with no room left. The durable write
 * still raises — whoever asked to keep the bytes has to learn it did
 * not happen — but the bytes stay reachable for the rest of the
 * session, which is what lets a project upload a video the device it
 * was dropped on refused to store.
 *
 * Bytes the durable cache did keep are not held here, on purpose. The
 * blob handed in is the file the reader picked, and on iOS a picked
 * file is a temporary copy the system removes on its own schedule;
 * the durable copy is the one the browser keeps alive as long as a
 * record points at it. Answering from the durable cache once it has
 * the bytes costs one read of a lazy reference, and is the same path
 * every open in a new session already takes.
 *
 * The held blob is probed before it is handed out, for the same
 * reason. When it will not read it is dropped and the durable cache
 * is asked instead; a project that was never kept there then misses
 * as `held-file-gone`.
 */
export class MemoryFirstVideoBlobCache implements VideoBlobCache {
  private held: HeldVideo | null = null;

  constructor(
    private readonly durable: VideoBlobCache,
    private readonly probe: BlobReadabilityProbe,
  ) {}

  async load(projectId: string): Promise<VideoBlobLookup> {
    if (this.held?.projectId !== projectId) return this.durable.load(projectId);
    if (await this.probe.probe(this.held.blob) === 'readable') {
      return { outcome: 'found', blob: this.held.blob, source: 'memory' };
    }
    this.held = null;
    return this.loadAfterHeldFileWentAway(projectId);
  }

  /**
   * Holds `blob` before the durable write is attempted, so a refused
   * write leaves the bytes reachable rather than losing them, and
   * lets go of it once the write went through.
   */
  async store(projectId: string, blob: Blob): Promise<void> {
    const holding: HeldVideo = { projectId, blob };
    this.held = holding;
    await this.durable.store(projectId, blob);
    if (this.held === holding) this.held = null;
  }

  async delete(projectId: string): Promise<void> {
    if (this.held?.projectId === projectId) this.held = null;
    await this.durable.delete(projectId);
  }

  private async loadAfterHeldFileWentAway(projectId: string): Promise<VideoBlobLookup> {
    const durable = await this.durable.load(projectId);
    if (durable.outcome === 'missing' && durable.reason === 'absent') {
      return { outcome: 'missing', reason: 'held-file-gone' };
    }
    return durable;
  }
}
