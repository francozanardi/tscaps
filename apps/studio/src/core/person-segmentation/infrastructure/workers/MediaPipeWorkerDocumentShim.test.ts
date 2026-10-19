import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaPipeWorkerDocumentShim } from '@core/person-segmentation/infrastructure/workers/MediaPipeWorkerDocumentShim';

const MAC_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** The probe MediaPipe 0.10.14 runs before reading a GPU mask back as floats. */
function mediaPipeTakesTouchReadback(): boolean {
  const scope = self as unknown as { document: object };
  return navigator.userAgent.includes('Mac') && 'ontouchend' in scope.document;
}

function workerScope(maxTouchPoints: number, scope: object = {}): void {
  vi.stubGlobal('self', scope);
  vi.stubGlobal('navigator', { userAgent: MAC_USER_AGENT, platform: 'MacIntel', maxTouchPoints });
}

describe('MediaPipeWorkerDocumentShim', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lets the probe run in a worker on a desktop Mac, taking the desktop readback', () => {
    workerScope(0);
    expect(mediaPipeTakesTouchReadback).toThrow(TypeError);
    new MediaPipeWorkerDocumentShim().install();
    expect(mediaPipeTakesTouchReadback()).toBe(false);
  });

  it('answers the probe as a touch device on an iPad presenting as a Mac', () => {
    workerScope(5);
    new MediaPipeWorkerDocumentShim().install();
    expect(mediaPipeTakesTouchReadback()).toBe(true);
  });

  it('leaves a scope that already has a document untouched', () => {
    const document = {};
    workerScope(5, { document });
    new MediaPipeWorkerDocumentShim().install();
    expect((self as unknown as { document: object }).document).toBe(document);
    expect(mediaPipeTakesTouchReadback()).toBe(false);
  });
});
