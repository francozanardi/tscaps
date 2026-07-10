import type { RenderOutputChunk } from '@tscaps/engine';
import type { PreviewProxyOutputStrategy } from '@core/preview/domain/PreviewProxyOutputStrategy';
import type {
  OpfsWriterInbound,
  OpfsWriterOutbound,
} from '@core/_shared/opfs/OpfsWriterWorkerHost';

const OPFS_PREFIX = 'preview-proxy-';

interface PendingJob {
  resolve: (response: Extract<OpfsWriterOutbound, { type: 'ok' }>) => void;
  reject: (err: Error) => void;
}

/**
 * Stages the encoded proxy in OPFS through a worker that owns a
 * `FileSystemSyncAccessHandle`. Writes are synchronous on the worker
 * thread and never touch the main-thread heap, which is what makes
 * long / high-bitrate proxies survivable on memory-pressured mobile
 * tabs where a `BufferTarget` would OOM.
 *
 * `collect` returns a `File` backed by the on-disk entry — the
 * browser streams from disk when that file is later loaded, so the
 * bytes never need to be materialized in the heap at once.
 *
 * The strategy stages its file under a dedicated prefix so it does
 * not race with the export writer's cleanup of stale files under a
 * different prefix.
 */
export class OpfsPreviewProxyOutputStrategy implements PreviewProxyOutputStrategy {

  static isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && navigator.storage !== undefined
      && typeof navigator.storage.getDirectory === 'function';
  }

  private nextId = 1;
  private readonly pending = new Map<number, PendingJob>();
  private filename: string | null = null;
  private disposed = false;

  constructor(private readonly worker: Worker) {
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
    this.worker.addEventListener('messageerror', (e) => {
      console.error('[opfs proxy writer] messageerror', e);
    });
  }

  async open(mimeType: string): Promise<WritableStream<RenderOutputChunk>> {
    if (this.filename) throw new Error('Strategy already opened');
    await this.cleanupStale();
    const filename = `${OPFS_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${this.pickExtensionFor(mimeType)}`;
    await this.send({ type: 'open', id: this.nextId++, filename });
    this.filename = filename;
    return this.buildWritable();
  }

  async collect(): Promise<Blob> {
    const name = this.filename;
    if (!name) throw new Error('Strategy not opened');
    await this.send({ type: 'close', id: this.nextId++ });
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(name);
    const file = await handle.getFile();
    this.filename = null;
    return file;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const name = this.filename;
    this.filename = null;
    if (name) void this.abortAndRemove(name);
    this.worker.terminate();
    for (const job of this.pending.values()) {
      job.reject(new Error('Strategy disposed'));
    }
    this.pending.clear();
  }

  private buildWritable(): WritableStream<RenderOutputChunk> {
    return new WritableStream<RenderOutputChunk>({
      write: async (chunk) => {
        const buffer = this.toTransferableBuffer(chunk.data);
        await this.send(
          { type: 'writeAt', id: this.nextId++, buffer, position: chunk.position },
          [buffer],
        );
      },
    });
  }

  private toTransferableBuffer(data: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(data.byteLength);
    new Uint8Array(copy).set(data);
    return copy;
  }

  private pickExtensionFor(mimeType: string): string {
    const slash = mimeType.lastIndexOf('/');
    return slash >= 0 ? mimeType.slice(slash + 1) : 'bin';
  }

  private async abortAndRemove(name: string): Promise<void> {
    try {
      await this.send({ type: 'abort', id: this.nextId++ });
    } catch {
      // Worker may already be dead; fall through to the OPFS removal.
    }
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(name);
    } catch {
      // Best-effort cleanup.
    }
  }

  private async cleanupStale(): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      // lib.dom in our TS version doesn't declare `entries()` on
      // FileSystemDirectoryHandle yet, even though it's spec'd and shipping.
      const iterable = root as unknown as { entries: () => AsyncIterableIterator<[string, FileSystemHandle]> };
      const removals: Promise<void>[] = [];
      for await (const [name] of iterable.entries()) {
        if (name.startsWith(OPFS_PREFIX)) {
          removals.push(root.removeEntry(name).catch(() => undefined));
        }
      }
      await Promise.all(removals);
    } catch {
      // Best-effort: stale files take up space but don't block a new run.
    }
  }

  private send(message: OpfsWriterInbound, transfer?: Transferable[]): Promise<Extract<OpfsWriterOutbound, { type: 'ok' }>> {
    return new Promise((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject });
      if (transfer && transfer.length > 0) {
        this.worker.postMessage(message, transfer);
      } else {
        this.worker.postMessage(message);
      }
    });
  }

  private readonly handleMessage = (event: MessageEvent<OpfsWriterOutbound>): void => {
    const data = event.data;
    const job = this.pending.get(data.id);
    if (!job) return;
    this.pending.delete(data.id);
    if (data.type === 'ok') {
      job.resolve(data);
    } else {
      job.reject(new Error(data.message));
    }
  };

  private readonly handleError = (event: ErrorEvent): void => {
    console.error('[opfs proxy writer] uncaught error', event.message, `${event.filename}:${event.lineno}`, event.error);
    for (const job of this.pending.values()) {
      job.reject(new Error(event.message || 'Worker error'));
    }
    this.pending.clear();
  };
}
