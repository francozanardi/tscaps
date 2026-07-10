import type { RenderOutputChunk } from '@tscaps/engine';
import type { PreviewProxyOutputStrategy } from '@core/preview/domain/PreviewProxyOutputStrategy';

/**
 * Stages the encoded proxy in a JS `Uint8Array` that grows in place
 * as chunks arrive. Cheapest path when the whole output comfortably
 * fits in the tab's heap budget — desktop with plenty of RAM and
 * shorter clips.
 *
 * Chunk positions are not monotonic — the muxer may seek back to
 * patch earlier header regions once total sizes are known — so the
 * buffer supports writes at arbitrary offsets and tracks the highest
 * byte touched as the effective output length.
 */
export class MemoryPreviewProxyOutputStrategy implements PreviewProxyOutputStrategy {

  private static readonly INITIAL_CAPACITY_BYTES = 1024;

  private buffer: Uint8Array<ArrayBuffer> | null = null;
  private usedLength = 0;
  private mimeType: string | null = null;

  async open(mimeType: string): Promise<WritableStream<RenderOutputChunk>> {
    this.buffer = new Uint8Array(new ArrayBuffer(MemoryPreviewProxyOutputStrategy.INITIAL_CAPACITY_BYTES));
    this.usedLength = 0;
    this.mimeType = mimeType;
    return new WritableStream<RenderOutputChunk>({
      write: (chunk) => {
        this.writeAt(chunk.position, chunk.data);
      },
    });
  }

  async collect(): Promise<Blob> {
    if (this.buffer === null || this.mimeType === null) {
      throw new Error('Cannot collect before open');
    }
    if (this.usedLength === 0) {
      throw new Error('Output finished without producing bytes');
    }
    return new Blob([this.buffer.subarray(0, this.usedLength)], { type: this.mimeType });
  }

  dispose(): void {
    this.buffer = null;
    this.usedLength = 0;
    this.mimeType = null;
  }

  private writeAt(position: number, data: Uint8Array): void {
    if (this.buffer === null) throw new Error('Strategy not opened');
    const endPosition = position + data.byteLength;
    this.ensureCapacity(endPosition);
    this.buffer.set(data, position);
    if (endPosition > this.usedLength) this.usedLength = endPosition;
  }

  private ensureCapacity(requiredBytes: number): void {
    if (this.buffer === null) return;
    if (requiredBytes <= this.buffer.byteLength) return;
    let capacity = this.buffer.byteLength;
    while (capacity < requiredBytes) capacity *= 2;
    const grown = new Uint8Array(new ArrayBuffer(capacity));
    grown.set(this.buffer.subarray(0, this.usedLength));
    this.buffer = grown;
  }
}
