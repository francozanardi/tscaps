import type { AudioLayerDecoder } from '@modules/video/mediabunny/audio/AudioLayerDecoder';

/**
 * {@link AudioLayerDecoder} through the Web Audio API's
 * `decodeAudioData`, which reads the whole file at once and resamples
 * it to the rate asked for. Covers files the browser decodes only this
 * way. Main-thread only — `OfflineAudioContext` is not available inside
 * Worker contexts.
 */
export class WebAudioAudioLayerDecoder implements AudioLayerDecoder {

  async decode(source: Blob, sampleRate: number): Promise<AudioBuffer> {
    const context = new OfflineAudioContext(1, 1, sampleRate);
    return context.decodeAudioData(await source.arrayBuffer());
  }
}
