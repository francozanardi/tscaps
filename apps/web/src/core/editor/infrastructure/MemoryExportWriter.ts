import type { RenderOutputChunk } from '@tscaps/engine';
import type { ExportWriter } from '@core/editor/domain/ExportWriter';

/**
 * Last-resort writer that accumulates encoded bytes in the JS heap and
 * hands them off as a `File` at the end. Always available, but pays the
 * memory cost of the entire encoded output; the dispatcher only falls
 * back to this when no other writer is supported.
 *
 * Honors the muxer's positional writes: chunks are kept with their
 * absolute offset and assembled into a contiguous buffer on
 * {@link finalize}.
 */
export class MemoryExportWriter implements ExportWriter {

  private chunks: Array<{ data: Uint8Array; position: number }> = [];
  private opened = false;

  async open(): Promise<void> {
    if (this.opened) throw new Error('writer already opened');
    this.opened = true;
  }

  stream(): WritableStream<RenderOutputChunk> {
    return new WritableStream<RenderOutputChunk>({
      write: (chunk) => {
        // Copy: the renderer may recycle its source buffer after the
        // write resolves.
        const data = new Uint8Array(chunk.data.byteLength);
        data.set(chunk.data);
        this.chunks.push({ data, position: chunk.position });
      },
    });
  }

  async finalize(): Promise<File | null> {
    if (!this.opened) throw new Error('writer not opened');
    let size = 0;
    for (const chunk of this.chunks) {
      const end = chunk.position + chunk.data.byteLength;
      if (end > size) size = end;
    }
    const buffer = new Uint8Array(size);
    for (const chunk of this.chunks) buffer.set(chunk.data, chunk.position);
    this.chunks = [];
    return new File([buffer], 'export');
  }

  async abort(): Promise<void> {
    this.chunks = [];
  }

  dispose(): void {
    this.chunks = [];
  }
}
