import { describe, expect, it } from 'vitest';
import { SliceReadBlobReadabilityProbe } from '@core/_shared/infrastructure/SliceReadBlobReadabilityProbe';

/**
 * This class is a translation table between what a browser raises for
 * a read it cannot serve and what the caller is allowed to conclude,
 * and getting one entry wrong is invisible until an export dies on a
 * video that was sitting intact somewhere else. The names below are
 * the ones observed in production and on real Safari, not a guess at
 * the specification.
 */

/** A blob whose every read fails with `error`. */
function unreadableBlob(error: unknown): Blob {
  return {
    slice: () => ({ arrayBuffer: () => Promise.reject(error) }),
  } as unknown as Blob;
}

describe('SliceReadBlobReadabilityProbe', () => {
  const probe = new SliceReadBlobReadabilityProbe();

  it('reads a live blob', async () => {
    expect(await probe.probe(new Blob(['frames']))).toBe('readable');
  });

  it('calls a file the browser no longer has gone', async () => {
    const gone = unreadableBlob(new DOMException('The object can not be found here.', 'NotFoundError'));

    expect(await probe.probe(gone)).toBe('gone');
  });

  it('calls a file the runtime refuses to open unreadable, which is what a picked file becomes on WebKit', async () => {
    const refused = unreadableBlob(new DOMException('The I/O read operation failed.', 'NotReadableError'));

    expect(await probe.probe(refused)).toBe('unreadable');
  });

  it('raises anything else, so a broken database is never mistaken for an absence', async () => {
    const broken = unreadableBlob(new DOMException('An internal error was encountered.', 'UnknownError'));

    await expect(probe.probe(broken)).rejects.toBeInstanceOf(DOMException);
  });
});
