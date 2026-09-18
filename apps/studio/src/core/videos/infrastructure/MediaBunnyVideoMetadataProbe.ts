import { ALL_FORMATS, BlobSource, Input, type InputAudioTrack, type InputVideoTrack } from 'mediabunny';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Reads container headers via mediabunny without decoding any frames.
 * Every field is queried independently and a failure on one does not
 * void the rest — the returned metadata reports `null` for the fields
 * that could not be resolved. The input handle is always disposed,
 * even when probing raises.
 *
 * Duration is the one field with a second chance: when the container
 * metadata carries no length, it falls back to a packet-timestamp
 * scan, which is slower but works on files written without a duration
 * header.
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
    const [sourceReadable, containerFormat, durationSeconds, audioProbe, videoTrack] = await Promise.all([
      this.readsBytes(media),
      this.readContainerFormat(input),
      this.readDuration(input),
      this.readPrimaryAudioTrack(input),
      this.readPrimaryVideoTrack(input),
    ]);
    const [audioCodec, audioSampleRate, audioChannels] = await this.readAudioFacts(audioProbe.track);
    const [videoCodec, videoWidthPx, videoHeightPx] = await this.readVideoFacts(videoTrack);
    return {
      mimeType: media.type ? media.type : null,
      sourceReadable,
      containerFormat,
      durationSeconds,
      videoCodec,
      videoWidthPx,
      videoHeightPx,
      hasAudioTrack: audioProbe.known ? audioProbe.track !== null : null,
      audioCodec,
      audioSampleRate,
      audioChannels,
    };
  }

  /**
   * Whether the runtime hands over the file's bytes at all, decided on
   * a single byte so the answer costs nothing.
   *
   * Every other read here goes through the container parser, which
   * cannot say whether it failed on the bytes or on their contents —
   * a file the browser refuses to read and a file it read but did not
   * recognise both arrive as an unparseable container. WebKit raises
   * `NotReadableError` on picked files often enough that the two need
   * telling apart: one asks the visitor to re-pick the file, the other
   * to convert it.
   */
  private async readsBytes(media: Blob): Promise<boolean> {
    try {
      await media.slice(0, 1).arrayBuffer();
      return true;
    } catch {
      return false;
    }
  }

  private async readContainerFormat(input: Input): Promise<string | null> {
    return this.swallow(async () => {
      const format = await input.getFormat();
      return format.name;
    });
  }

  private readDuration(input: Input): Promise<number | null> {
    return this.swallow(async () => {
      const fromMetadata = await input.getDurationFromMetadata();
      if (fromMetadata !== null && fromMetadata > 0) return fromMetadata;
      // Recordings written without a duration header (MediaRecorder
      // WebM, fragmented MP4) land here; scanning packet timestamps
      // is the only way to recover their real length.
      return input.computeDuration();
    });
  }

  // A missing track and a failed read must not collapse into the same
  // `null`: the first is a positive "this video has no audio" fact.
  private async readPrimaryAudioTrack(
    input: Input,
  ): Promise<{ track: InputAudioTrack | null; known: boolean }> {
    try {
      return { track: await input.getPrimaryAudioTrack(), known: true };
    } catch {
      return { track: null, known: false };
    }
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
