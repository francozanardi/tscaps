import type { CodecPolicy, MediaBunnyTranscodeCoordinator, MediaBunnyTranscodeRequest } from '@tscaps/engine/advanced';
import { describe, expect, it } from 'vitest';
import type { EncodedFileOutputStrategy } from '@core/_shared/domain/EncodedFileOutputStrategy';
import type { EncodedFileOutputStrategyFactory } from '@core/_shared/domain/EncodedFileOutputStrategyFactory';
import type { SoftwareHevcDecoder } from '@core/videos/domain/SoftwareHevcDecoder';
import { VideoConversionFailedError } from '@core/videos/domain/errors/VideoConversionFailedError';
import { SoftwareHevcVideoConverter } from '@core/videos/infrastructure/mediabunny/SoftwareHevcVideoConverter';

/**
 * A conversion can take minutes and most of a tab's memory. The promise
 * covered here: it stops when its signal aborts, says so as a stop and
 * not as a failure, and leaves nothing of the partial output behind.
 */

/** A transcode that runs until it is aborted or told to fail, as the engine's coordinator does. */
class HeldTranscode {
  request: MediaBunnyTranscodeRequest | null = null;
  private failWith: ((cause: Error) => void) | null = null;

  execute(request: MediaBunnyTranscodeRequest): Promise<never> {
    this.request = request;
    return new Promise<never>((_resolve, reject) => {
      this.failWith = reject;
      request.signal?.addEventListener('abort', () => {
        reject(new DOMException('The transcode was aborted.', 'AbortError'));
      }, { once: true });
    });
  }

  fail(cause: Error): void {
    this.failWith?.(cause);
  }
}

class DisposableOutput implements EncodedFileOutputStrategy {
  disposed = false;

  async open(): Promise<WritableStream> {
    return new WritableStream();
  }

  async collect(): Promise<Blob> {
    return new Blob(['converted']);
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** Lets queued work run until `condition` holds; fails when it never does. */
async function until(condition: () => boolean): Promise<void> {
  for (let tick = 0; tick < 200; tick++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('The awaited condition never held');
}

describe('SoftwareHevcVideoConverter', () => {
  const substitute = <T>(stub: object): T => stub as T;
  const source = new File(['hevc'], 'IMG_0042.MOV', { type: 'video/quicktime' });

  function converterOver(transcode: HeldTranscode, output: DisposableOutput): SoftwareHevcVideoConverter {
    return new SoftwareHevcVideoConverter(
      substitute<SoftwareHevcDecoder>({ install: async () => undefined }),
      substitute<MediaBunnyTranscodeCoordinator>({ execute: (request: MediaBunnyTranscodeRequest) => transcode.execute(request) }),
      substitute<CodecPolicy>({}),
      substitute<EncodedFileOutputStrategyFactory>({ create: () => output }),
    );
  }

  it('stops when its signal aborts, rejecting with the stop rather than a failure, and drops the partial output', async () => {
    const transcode = new HeldTranscode();
    const output = new DisposableOutput();
    const stop = new AbortController();

    const converting = converterOver(transcode, output).convert(source, () => undefined, stop.signal);
    await until(() => transcode.request !== null);
    stop.abort();

    await expect(converting).rejects.toMatchObject({ name: 'AbortError' });
    expect(transcode.request?.signal).toBe(stop.signal);
    expect(output.disposed).toBe(true);
  });

  it('does not start a transcode once its signal has aborted', async () => {
    const transcode = new HeldTranscode();
    const stop = new AbortController();
    stop.abort();

    await expect(converterOver(transcode, new DisposableOutput()).convert(source, () => undefined, stop.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(transcode.request).toBeNull();
  });

  it('fails as a conversion when the transcode fails on its own', async () => {
    const transcode = new HeldTranscode();
    const output = new DisposableOutput();

    const converting = converterOver(transcode, output).convert(source, () => undefined, new AbortController().signal);
    await until(() => transcode.request !== null);
    transcode.fail(new Error('decoder gave up'));

    await expect(converting).rejects.toBeInstanceOf(VideoConversionFailedError);
    expect(output.disposed).toBe(true);
  });
});
