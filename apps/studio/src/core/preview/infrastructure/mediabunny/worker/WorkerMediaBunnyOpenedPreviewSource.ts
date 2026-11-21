import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';
import type { PreviewVideoTrack } from '@core/preview/domain/PreviewVideoTrack';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';
import type { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';

/**
 * {@link OpenedPreviewSource} whose pictures and sound are both
 * decoded in a decode worker. Owns the {@link DecodeWorkerClient}
 * that drives it; {@link dispose} terminates the worker so the
 * WebCodecs contexts it holds are returned to the browser pool.
 */
export class WorkerMediaBunnyOpenedPreviewSource implements OpenedPreviewSource {

  private disposed = false;

  constructor(
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
  }
}
