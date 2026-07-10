// lib.dom in our TS version doesn't yet declare these worker-side OPFS
// types, so we describe the subset we use locally.
interface SyncAccessHandle {
  write(buffer: ArrayBufferView, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
  getSize(): number;
}

interface FileHandleWithSyncAccess extends FileSystemFileHandle {
  createSyncAccessHandle(): Promise<SyncAccessHandle>;
}

export type OpfsWriterInbound =
  | { type: 'open'; id: number; filename: string }
  | { type: 'writeAt'; id: number; buffer: ArrayBuffer; position: number }
  | { type: 'close'; id: number }
  | { type: 'abort'; id: number };

export type OpfsWriterOutbound =
  | { type: 'ok'; id: number; size?: number }
  | { type: 'err'; id: number; message: string };

/**
 * Worker-side counterpart of `OpfsExportWriter`. Owns a single
 * `FileSystemSyncAccessHandle` for the duration of an export and drains
 * positional writes straight to OPFS — `SyncAccessHandle.write` is
 * worker-only and synchronous, so writes don't queue against the event
 * loop the way main-thread OPFS or `Blob` accumulation do.
 */
export class OpfsWriterWorkerHost {

  private handle: SyncAccessHandle | null = null;
  private filename: string | null = null;

  start(): void {
    self.addEventListener('message', this.handleMessage);
  }

  private readonly handleMessage = (event: MessageEvent<OpfsWriterInbound>): void => {
    const msg = event.data;
    void this.dispatch(msg);
  };

  private async dispatch(msg: OpfsWriterInbound): Promise<void> {
    try {
      switch (msg.type) {
        case 'open':
          await this.open(msg.filename);
          this.post({ type: 'ok', id: msg.id });
          return;
        case 'writeAt':
          this.writeAt(msg.buffer, msg.position);
          this.post({ type: 'ok', id: msg.id });
          return;
        case 'close': {
          const size = this.close();
          this.post({ type: 'ok', id: msg.id, size });
          return;
        }
        case 'abort':
          await this.abort();
          this.post({ type: 'ok', id: msg.id });
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.post({ type: 'err', id: msg.id, message });
    }
  }

  private async open(filename: string): Promise<void> {
    if (this.handle) throw new Error('writer already open');
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true }) as FileHandleWithSyncAccess;
    this.handle = await fileHandle.createSyncAccessHandle();
    this.handle.truncate(0);
    this.filename = filename;
  }

  private writeAt(buffer: ArrayBuffer, position: number): void {
    if (!this.handle) throw new Error('writer not open');
    this.handle.write(new Uint8Array(buffer), { at: position });
  }

  private close(): number {
    if (!this.handle) return 0;
    this.handle.flush();
    const size = this.handle.getSize();
    this.handle.close();
    this.handle = null;
    this.filename = null;
    return size;
  }

  private async abort(): Promise<void> {
    if (this.handle) {
      try { this.handle.close(); } catch { /* ignore */ }
      this.handle = null;
    }
    const name = this.filename;
    this.filename = null;
    if (!name) return;
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(name);
    } catch { /* already gone */ }
  }

  private post(message: OpfsWriterOutbound): void {
    (self as unknown as Worker).postMessage(message);
  }
}
