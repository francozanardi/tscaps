import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';
import type { DecodedAudioPayload } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';

/**
 * {@link PreviewAudioFrame} over a run of sound the decode worker
 * decoded and handed across: plain samples per channel, which this
 * thread only has to wrap in an `AudioBuffer`. It holds no decoder
 * resource, so closing it has nothing to release.
 */
export class WorkerPcmPreviewAudioFrame implements PreviewAudioFrame {

  constructor(private readonly payload: DecodedAudioPayload) {}

  get timestampSec(): number {
    return this.payload.timestampSec;
  }

  toAudioBuffer(): AudioBuffer {
    const { channels, sampleRate } = this.payload;
    const buffer = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0]?.length ?? 0, sampleRate });
    channels.forEach((samples, channel) => buffer.copyToChannel(samples, channel));
    return buffer;
  }

  close(): void {}
}
