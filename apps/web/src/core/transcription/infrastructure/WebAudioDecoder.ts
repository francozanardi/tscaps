import type { AudioDecoder } from '@tscaps/engine';

/**
 * Browser AudioDecoder implementation that uses Web Audio APIs to decode
 * any audio/video Blob into mono Float32Array PCM at the target sample
 * rate. Main-thread only — Worker contexts have no AudioContext or
 * OfflineAudioContext. The decode and resample work is performed by the
 * browser's audio engine asynchronously and does not appreciably block JS.
 */
export class WebAudioDecoder implements AudioDecoder {
  async decode(audio: Blob, targetSampleRate: number): Promise<Float32Array> {
    const arrayBuffer = await audio.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      return await this.resample(audioBuffer, targetSampleRate);
    } finally {
      await ctx.close();
    }
  }

  private async resample(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<Float32Array> {
    if (audioBuffer.sampleRate === targetSampleRate && audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0);
    }
    const sampleCount = Math.ceil(audioBuffer.duration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(1, sampleCount, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const resampled = await offlineCtx.startRendering();
    return resampled.getChannelData(0);
  }
}
