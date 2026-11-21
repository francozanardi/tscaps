import { AudioBufferSink, type Input, type InputAudioTrack } from 'mediabunny';
import type { PreviewAudioChunk, PreviewAudioSource } from '@core/preview/domain/PreviewAudioSource';

/**
 * {@link PreviewAudioSource} decoded as it is read, through WebCodecs,
 * from an opened file: only the stretch being played is held in memory.
 * Chunks come at the track's own rate, placed at their timestamps.
 */
export class MediaBunnyStreamedPreviewAudioSource implements PreviewAudioSource {
  private readonly sink: AudioBufferSink;

  constructor(
    private readonly input: Input,
    track: InputAudioTrack,
    readonly durationSec: number,
  ) {
    this.sink = new AudioBufferSink(track);
  }

  async *chunksFrom(sourceSec: number): AsyncIterable<PreviewAudioChunk> {
    for await (const piece of this.sink.buffers(sourceSec)) {
      yield { buffer: piece.buffer, timestampSec: piece.timestamp };
    }
  }

  dispose(): void {
    this.input.dispose();
  }
}
