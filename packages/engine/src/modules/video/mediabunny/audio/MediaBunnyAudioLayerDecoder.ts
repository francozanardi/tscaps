import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  Input,
  type InputAudioTrack,
  type WrappedAudioBuffer,
} from 'mediabunny';
import type { AudioLayerDecoder } from '@modules/video/mediabunny/audio/AudioLayerDecoder';

/**
 * {@link AudioLayerDecoder} that demuxes the source with mediabunny and
 * decodes its primary audio track through WebCodecs, placing each
 * decoded buffer at its timestamp, then resamples through an
 * `OfflineAudioContext` when the track's rate is not the one asked for.
 * Main-thread only — `OfflineAudioContext` is not available inside
 * Worker contexts.
 *
 * Rejects when the source has no audio track or its codec cannot be
 * decoded here.
 */
export class MediaBunnyAudioLayerDecoder implements AudioLayerDecoder {

  async decode(source: Blob, sampleRate: number): Promise<AudioBuffer> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source) });
    try {
      const track = await this.decodableTrackOf(input);
      const native = await this.decodeAtTrackRate(track);
      return native.sampleRate === sampleRate ? native : await this.resample(native, sampleRate);
    } finally {
      input.dispose();
    }
  }

  private async decodableTrackOf(input: Input): Promise<InputAudioTrack> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('The source has no audio track.');
    if (!(await track.canDecode())) {
      throw new DOMException(
        `The source's audio codec cannot be decoded here: ${await track.getCodec() ?? 'unknown'}.`,
        'NotSupportedError',
      );
    }
    return track;
  }

  private async decodeAtTrackRate(track: InputAudioTrack): Promise<AudioBuffer> {
    const pieces: WrappedAudioBuffer[] = [];
    for await (const piece of new AudioBufferSink(track).buffers()) pieces.push(piece);
    const sampleRate = pieces[0]?.buffer.sampleRate ?? track.sampleRate;
    const numberOfChannels = pieces[0]?.buffer.numberOfChannels ?? track.numberOfChannels;
    const length = pieces.reduce(
      (longest, piece) => Math.max(longest, this.frameOf(piece.timestamp, sampleRate) + piece.buffer.length),
      1,
    );
    const whole = new AudioBuffer({ length, numberOfChannels, sampleRate });
    for (const piece of pieces) this.place(piece, whole);
    return whole;
  }

  /** Copies `piece` into `whole` at its timestamp, leaving out what falls before 0. */
  private place(piece: WrappedAudioBuffer, whole: AudioBuffer): void {
    const at = this.frameOf(piece.timestamp, whole.sampleRate);
    const skipped = Math.max(0, -at);
    if (skipped >= piece.buffer.length) return;
    const channels = Math.min(piece.buffer.numberOfChannels, whole.numberOfChannels);
    for (let channel = 0; channel < channels; channel++) {
      whole.copyToChannel(piece.buffer.getChannelData(channel).subarray(skipped), channel, at + skipped);
    }
  }

  private frameOf(timestampSec: number, sampleRate: number): number {
    return Math.round(timestampSec * sampleRate);
  }

  private async resample(buffer: AudioBuffer, sampleRate: number): Promise<AudioBuffer> {
    const length = Math.max(1, Math.round(buffer.duration * sampleRate));
    const context = new OfflineAudioContext(buffer.numberOfChannels, length, sampleRate);
    const player = context.createBufferSource();
    player.buffer = buffer;
    player.connect(context.destination);
    player.start(0);
    return context.startRendering();
  }
}
