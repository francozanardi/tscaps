import {
  ALL_FORMATS,
  BlobSource,
  Input,
  type InputVideoTrack,
} from 'mediabunny';
import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';
import type { PreviewSourceLoader } from '@core/preview/domain/PreviewSourceLoader';
import { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';
import { WorkerMediaBunnyAudioTrack } from '@core/preview/infrastructure/mediabunny/worker/WorkerMediaBunnyAudioTrack';
import { WorkerMediaBunnyOpenedPreviewSource } from '@core/preview/infrastructure/mediabunny/worker/WorkerMediaBunnyOpenedPreviewSource';
import { WorkerMediaBunnyVideoTrack } from '@core/preview/infrastructure/mediabunny/worker/WorkerMediaBunnyVideoTrack';
import type { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';
import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';

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
 *
 * The file is read here only to check it and size the picture; the
 * decode worker opens it again and decodes both its pictures and its
 * sound from then on.
 */
export class MediaBunnyPreviewSourceLoader implements PreviewSourceLoader {

  constructor(
    private readonly resolutionCap: PreviewResolutionCap,
    private readonly workerErrorMonitor: WorkerErrorMonitor,
  ) {}

  async open(source: Blob): Promise<OpenedPreviewSource> {
    const metadata = await this.checkedVideoMetadata(source);
    const target = this.resolutionCap.clamp(metadata.widthPx, metadata.heightPx);
    const workerClient = new DecodeWorkerClient(this.workerErrorMonitor);
    try {
      const opened = await workerClient.open(source, target.widthPx, target.heightPx);
      return new WorkerMediaBunnyOpenedPreviewSource(
        workerClient,
        new WorkerMediaBunnyVideoTrack(workerClient),
        opened.hasAudio ? new WorkerMediaBunnyAudioTrack(workerClient) : null,
        metadata.widthPx,
        metadata.heightPx,
        metadata.durationSec,
        metadata.codec,
      );
    } catch (err) {
      workerClient.dispose();
      throw err;
    }
  }

  /** What the file's video is, read on this thread; throws where it has none or this browser cannot decode it. */
  private async checkedVideoMetadata(source: Blob): Promise<VideoMetadata> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source) });
    try {
      const videoTrack = await this.requirePrimaryVideoTrack(input);
      await this.requireDecodableVideoCodec(videoTrack);
      return await this.readVideoMetadata(videoTrack);
    } finally {
      input.dispose();
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
