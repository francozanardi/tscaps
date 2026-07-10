import type { Input } from 'mediabunny';
import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';
import type { PreviewVideoTrack } from '@core/preview/domain/PreviewVideoTrack';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';
import type { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';

/**
 * {@link OpenedPreviewSource} whose video decoding runs in a
 * decode worker while audio stays on the main thread. Owns both
 * halves of the runtime: the main-thread mediabunny
 * {@link Input} used for audio decode and the {@link DecodeWorkerClient}
 * that drives the video worker. {@link dispose} releases both and
 * terminates the worker so the WebCodecs contexts it holds are
 * returned to the browser pool.
 */
export class WorkerMediaBunnyOpenedPreviewSource implements OpenedPreviewSource {

  private disposed = false;

  constructor(
    private readonly mainThreadInput: Input,
    private readonly workerClient: DecodeWorkerClient,
    readonly videoTrack: PreviewVideoTrack,
    readonly audioTrack: PreviewAudioTrack | null,
    readonly widthPx: number,
    readonly heightPx: number,
    readonly durationSec: number,
    readonly videoCodec: string,
  ) {}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.workerClient.dispose();
    if (!this.mainThreadInput.disposed) this.mainThreadInput.dispose();
  }
}
