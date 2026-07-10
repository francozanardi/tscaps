import type { AudioSample } from 'mediabunny';
import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';

/**
 * Adapter that exposes a mediabunny {@link AudioSample} through the
 * domain-shaped {@link PreviewAudioFrame} port. The vendor type is
 * confined to this file; everything downstream sees only the port.
 */
export class MediaBunnyAudioFrame implements PreviewAudioFrame {

  constructor(private readonly sample: AudioSample) {}

  get timestampSec(): number {
    return this.sample.timestamp;
  }

  toAudioBuffer(): AudioBuffer {
    return this.sample.toAudioBuffer();
  }

  close(): void {
    this.sample.close();
  }
}
