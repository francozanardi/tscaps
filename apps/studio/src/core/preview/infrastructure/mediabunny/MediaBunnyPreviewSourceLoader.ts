import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  Input,
  type InputAudioTrack,
  type InputVideoTrack,
} from 'mediabunny';
import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';
import type { PreviewSourceLoader } from '@core/preview/domain/PreviewSourceLoader';
import { MediaBunnyAudioTrack } from '@core/preview/infrastructure/mediabunny/MediaBunnyAudioTrack';
import { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';
import { WorkerMediaBunnyOpenedPreviewSource } from '@core/preview/infrastructure/mediabunny/worker/WorkerMediaBunnyOpenedPreviewSource';
import { WorkerMediaBunnyVideoTrack } from '@core/preview/infrastructure/mediabunny/worker/WorkerMediaBunnyVideoTrack';
import type { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';

interface VideoMetadata {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly durationSec: number;
  readonly codec: string;
}

/**
 * mediabunny-backed implementation of {@link PreviewSourceLoader}.
 * Throws when the file has no video track or its video codec
 * cannot be decoded by WebCodecs in this browser. Missing or
 * undecodable audio is tolerated — the returned source carries a
 * `null` `audioTrack` and the surface plays video silently.
 */
export class MediaBunnyPreviewSourceLoader implements PreviewSourceLoader {

  constructor(private readonly resolutionCap: PreviewResolutionCap) {}

  async open(source: Blob): Promise<OpenedPreviewSource> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source) });
    let workerClient: DecodeWorkerClient | null = null;
    try {
      const videoTrack = await this.requirePrimaryVideoTrack(input);
      await this.requireDecodableVideoCodec(videoTrack);
      const audioTrack = await this.tryBuildAudioTrack(input);
      const metadata = await this.readVideoMetadata(videoTrack);
      const target = this.resolutionCap.clamp(metadata.widthPx, metadata.heightPx);
      workerClient = new DecodeWorkerClient();
      await workerClient.open(source, target.widthPx, target.heightPx);
      return new WorkerMediaBunnyOpenedPreviewSource(
        input,
        workerClient,
        new WorkerMediaBunnyVideoTrack(workerClient),
        audioTrack,
        metadata.widthPx,
        metadata.heightPx,
        metadata.durationSec,
        metadata.codec,
      );
    } catch (err) {
      workerClient?.dispose();
      input.dispose();
      throw err;
    }
  }

  private async requirePrimaryVideoTrack(input: Input): Promise<InputVideoTrack> {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('The selected file has no video track.');
    return track;
  }

  private async requireDecodableVideoCodec(track: InputVideoTrack): Promise<void> {
    const canDecode = await track.canDecode();
    if (canDecode) return;
    const codec = (await track.getCodec()) ?? 'unknown';
    throw new Error(
      `This browser cannot decode the video codec "${codec}". `
      + `Convert the source to H.264 and try again.`,
    );
  }

  private async tryBuildAudioTrack(input: Input): Promise<MediaBunnyAudioTrack | null> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    const canDecode = await this.canDecodeAudioTrack(track);
    if (!canDecode) return null;
    return new MediaBunnyAudioTrack(new AudioSampleSink(track));
  }

  private async canDecodeAudioTrack(track: InputAudioTrack): Promise<boolean> {
    try {
      return await track.canDecode();
    } catch {
      return false;
    }
  }

  private async readVideoMetadata(track: InputVideoTrack): Promise<VideoMetadata> {
    const [widthPx, heightPx, durationSec, codec] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.computeDuration(),
      track.getCodec(),
    ]);
    return { widthPx, heightPx, durationSec, codec: codec ?? 'unknown' };
  }
}
