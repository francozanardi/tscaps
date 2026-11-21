import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';
import type { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';
import { WorkerPcmPreviewAudioFrame } from '@core/preview/infrastructure/mediabunny/worker/WorkerPcmPreviewAudioFrame';

/**
 * {@link PreviewAudioTrack} whose sound is decoded in the decode worker
 * and arrives a fraction of a second at a time. Demuxing and decoding
 * stay off this thread, which receives a few messages a second however
 * many packets they hold — so sound keeps coming while this thread is
 * too busy to run a decoder's callbacks packet by packet.
 */
export class WorkerMediaBunnyAudioTrack implements PreviewAudioTrack {

  constructor(private readonly client: DecodeWorkerClient) {}

  async *streamFrames(startSourceSec: number): AsyncIterable<PreviewAudioFrame> {
    for await (const payload of this.client.streamAudio(startSourceSec)) {
      yield new WorkerPcmPreviewAudioFrame(payload);
    }
  }
}
