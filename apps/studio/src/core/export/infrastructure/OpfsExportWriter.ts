import type { OutputFormat, RenderOutputChunk } from '@tscaps/engine';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type {
  OpfsWriterInbound,
  OpfsWriterOutbound,
} from '@core/_shared/opfs/OpfsWriterWorkerHost';

const OPFS_PREFIX = 'export-';

interface PendingJob {
  resolve: (response: Extract<OpfsWriterOutbound, { type: 'ok' }>) => void;
  reject: (err: Error) => void;
}

/**
 * Stages encoded export bytes in OPFS through a worker that owns a
 * `FileSystemSyncAccessHandle`. The handle's synchronous write keeps
 * writes off the message-loop queue, and {@link finalize} returns a
 * `File` backed by the on-disk entry — the browser streams from disk
 * when that file is handed to an `<a download>`, so the bytes never
 * need to live in heap.
 *
 * The fallback path in browsers without `showSaveFilePicker` (Firefox,
 * Safari) where the only alternative is to accumulate the whole encoded
 * file in JS memory.
 */
export class OpfsExportWriter implements ExportWriter {

  static isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && navigator.storage !== undefined
      && typeof navigator.storage.getDirectory === 'function';
  }

  private nextId = 1;
  private readonly pending = new Map<number, PendingJob>();
  private filename: string | null = null;

  constructor(private readonly worker: Worker) {
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
    this.worker.addEventListener('messageerror', (e) => {
      console.error('[opfs writer worker] messageerror', e);
    });
  }

  async open(format: OutputFormat): Promise<void> {
    if (this.filename) throw new Error('writer already opened');
    await this.cleanupStale();
    const filename = `${OPFS_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`;
    await this.send({ type: 'open', id: this.nextId++, filename });
    this.filename = filename;
  }

  stream(): WritableStream<RenderOutputChunk> {
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

  async finalize(): Promise<File | null> {
    const name = this.filename;
    if (!name) throw new Error('writer not opened');
    await this.send({ type: 'close', id: this.nextId++ });
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(name);
    return handle.getFile();
  }

  async abort(): Promise<void> {
    try {
      await this.send({ type: 'abort', id: this.nextId++ });
    } catch {
      // Best-effort: the worker may already be gone if the render aborted
      // through an error that also terminated the message channel.
    }
    this.filename = null;
  }

  dispose(): void {
    this.worker.terminate();
    for (const job of this.pending.values()) {
      job.reject(new Error('Worker terminated'));
    }
    this.pending.clear();
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

  // RenderOutputChunk hands us a Uint8Array view that may overlap a
  // larger shared buffer owned by the renderer. Copy into a fresh
  // ArrayBuffer so we can transfer ownership to the worker without
  // invalidating views the renderer might still hold.
  private toTransferableBuffer(data: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(data.byteLength);
    new Uint8Array(copy).set(data);
    return copy;
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
      // Best-effort: stale files take up space but don't break a new export.
    }
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
    console.error('[opfs writer worker] uncaught error', event.message, event.filename + ':' + event.lineno, event.error);
    for (const job of this.pending.values()) {
      job.reject(new Error(event.message || 'Worker error'));
    }
    this.pending.clear();
  };
}
