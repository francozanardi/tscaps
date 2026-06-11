import type { AudioDecoder } from '@modules/transcription/AudioDecoder';

/**
 * Reads a Blob whose bytes are already a Float32Array of mono PCM at the
 * agreed sample rate. The blob carries no metadata — the caller and the
 * decoder share the targetSampleRate by convention. Useful in Worker
 * contexts where browser audio decoding APIs are unavailable: a main-thread
 * caller decodes once, then ships the raw PCM bytes as a Blob.
 */
export class PreDecodedAudioDecoder implements AudioDecoder {
  async decode(audio: Blob, _targetSampleRate: number): Promise<Float32Array> {
    const buffer = await audio.arrayBuffer();
    return new Float32Array(buffer);
  }
}
