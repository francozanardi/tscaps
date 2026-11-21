import { open, type FileHandle } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { FileReservations } from '@mcp/domain/FileReservations';

/** A file the page may write to, under the id it is given. */
interface Destination {
  readonly path: string;
  handle: FileHandle | null;
  bytes: number;
}

/**
 * Files on disk the page may write to, each under an opaque id handed to
 * it with the call that asks for the file: the page never names a path.
 * A destination is created empty on its first write and closed when it
 * is released.
 */
export class FileDestinations implements FileReservations {
  private readonly byId = new Map<string, Destination>();

  /** Opens `path` to the page under a fresh id. The file is truncated on the first write. */
  reserve(path: string): string {
    const id = randomBytes(12).toString('hex');
    this.byId.set(id, { path, handle: null, bytes: 0 });
    return id;
  }

  /** Writes `bytes` at `position` of the file reserved under `id`. Throws for an id that is not reserved. */
  async write(id: string, position: number, bytes: Buffer): Promise<void> {
    const destination = this.byId.get(id);
    if (destination === undefined) throw new Error('no file is reserved under that id');
    destination.handle ??= await open(destination.path, 'w');
    await destination.handle.write(bytes, 0, bytes.length, position);
    destination.bytes = Math.max(destination.bytes, position + bytes.length);
  }

  /** Closes the file reserved under `id` and forgets the id. Answers how many bytes it holds. */
  async release(id: string): Promise<number> {
    const destination = this.byId.get(id);
    if (destination === undefined) return 0;
    this.byId.delete(id);
    await destination.handle?.close();
    return destination.bytes;
  }
}
