import type { BlobReadability, BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';

/**
 * `BlobReadabilityProbe` that reads the first byte — opening the file
 * is what fails, so one byte settles it.
 *
 * The failures are recognised by name because the messages are
 * engine-specific and, on WebKit, not even about files. Anything the
 * two names below do not cover is raised: it is not an absence, and
 * treating it as one would hide a broken database behind a miss.
 */
export class SliceReadBlobReadabilityProbe implements BlobReadabilityProbe {
  async probe(blob: Blob): Promise<BlobReadability> {
    try {
      await blob.slice(0, 1).arrayBuffer();
      return 'readable';
    } catch (error) {
      const readability = this.classify(error);
      if (readability === null) throw error;
      return readability;
    }
  }

  private classify(error: unknown): BlobReadability | null {
    if (!(error instanceof DOMException)) return null;
    if (error.name === 'NotFoundError') return 'gone';
    // What a picked file becomes on iOS and iPadOS once the system has
    // deleted the copy it handed the page.
    if (error.name === 'NotReadableError') return 'unreadable';
    return null;
  }
}
