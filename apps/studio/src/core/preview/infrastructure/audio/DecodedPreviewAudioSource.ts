import type { PreviewAudioChunk, PreviewAudioSource } from '@core/preview/domain/PreviewAudioSource';

/** {@link PreviewAudioSource} held whole in one decoded buffer: every read is that one chunk. */
export class DecodedPreviewAudioSource implements PreviewAudioSource {
  constructor(private readonly buffer: AudioBuffer) {}

  get durationSec(): number {
    return this.buffer.duration;
  }

  async *chunksFrom(): AsyncIterable<PreviewAudioChunk> {
    yield { buffer: this.buffer, timestampSec: 0 };
  }

  dispose(): void {
    // The buffer is let go with the source; nothing else is held.
  }
}
