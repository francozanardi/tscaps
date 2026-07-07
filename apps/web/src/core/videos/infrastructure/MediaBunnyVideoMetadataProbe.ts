import { ALL_FORMATS, BlobSource, Input, type InputAudioTrack, type InputVideoTrack } from 'mediabunny';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Reads container headers via mediabunny without decoding any frames.
 * Every field is queried independently and a failure on one does not
 * void the rest — the returned metadata reports `null` for the fields
 * that could not be resolved. The input handle is always disposed,
 * even when probing raises.
 */
export class MediaBunnyVideoMetadataProbe implements VideoMetadataProbe {
  async probe(media: Blob): Promise<VideoSourceMetadata> {
    const input = new Input({ source: new BlobSource(media), formats: ALL_FORMATS });
    try {
      return await this.readAll(media, input);
    } finally {
      input.dispose();
    }
  }

  private async readAll(media: Blob, input: Input): Promise<VideoSourceMetadata> {
    const [containerFormat, durationSeconds, audioTrack, videoTrack] = await Promise.all([
      this.readContainerFormat(input),
      this.readDuration(input),
      this.readPrimaryAudioTrack(input),
      this.readPrimaryVideoTrack(input),
    ]);
    const [audioCodec, audioSampleRate, audioChannels] = await this.readAudioFacts(audioTrack);
    const [videoCodec, videoWidthPx, videoHeightPx] = await this.readVideoFacts(videoTrack);
    return {
      mimeType: media.type ? media.type : null,
      containerFormat,
      durationSeconds,
      videoCodec,
      videoWidthPx,
      videoHeightPx,
      audioCodec,
      audioSampleRate,
      audioChannels,
    };
  }

  private async readContainerFormat(input: Input): Promise<string | null> {
    return this.swallow(async () => {
      const format = await input.getFormat();
      return format.name;
    });
  }

  private readDuration(input: Input): Promise<number | null> {
    return this.swallow(() => input.getDurationFromMetadata());
  }

  private readPrimaryAudioTrack(input: Input): Promise<InputAudioTrack | null> {
    return this.swallow(() => input.getPrimaryAudioTrack());
  }

  private readPrimaryVideoTrack(input: Input): Promise<InputVideoTrack | null> {
    return this.swallow(() => input.getPrimaryVideoTrack());
  }

  private async readAudioFacts(
    audioTrack: InputAudioTrack | null,
  ): Promise<[string | null, number | null, number | null]> {
    if (!audioTrack) return [null, null, null];
    return Promise.all([
      this.swallow(() => audioTrack.getCodec()),
      this.swallow(() => audioTrack.getSampleRate()),
      this.swallow(() => audioTrack.getNumberOfChannels()),
    ]);
  }

  private async readVideoFacts(
    videoTrack: InputVideoTrack | null,
  ): Promise<[string | null, number | null, number | null]> {
    if (!videoTrack) return [null, null, null];
    return Promise.all([
      this.swallow(() => videoTrack.getCodec()),
      this.swallow(() => videoTrack.getDisplayWidth()),
      this.swallow(() => videoTrack.getDisplayHeight()),
    ]);
  }

  // A probe failure must never break the upload — we report what we know.
  private async swallow<T>(read: () => Promise<T | null>): Promise<T | null> {
    try {
      return await read();
    } catch {
      return null;
    }
  }
}
