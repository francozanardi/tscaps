import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { CodecPolicy, MediaBunnyTranscodeCoordinator } from '@tscaps/engine';
import type { EncodedFileOutputStrategy } from '@core/_shared/domain/EncodedFileOutputStrategy';
import type { EncodedFileOutputStrategyFactory } from '@core/_shared/domain/EncodedFileOutputStrategyFactory';
import type { SoftwareHevcDecoder } from '@core/videos/domain/SoftwareHevcDecoder';
import type { VideoConversionEstimate, VideoConverter } from '@core/videos/domain/VideoConverter';
import { VideoConversionFailedError } from '@core/videos/domain/errors/VideoConversionFailedError';
import { SourceOnlyFramePainter } from '@core/preview/infrastructure/mediabunny/SourceOnlyFramePainter';

/**
 * Converts HEVC through the engine's own transcode coordinator, after
 * installing a software HEVC decoder, into a full-size H.264 MP4 staged
 * on disk rather than in the heap.
 *
 * Never falls back to the `<video>`-element decoder the coordinator
 * offers: where the software decoder does not take the track, the
 * conversion fails instead, because that decoder drops frames whenever
 * the encoder falls behind playback.
 */
export class SoftwareHevcVideoConverter implements VideoConverter {

  /**
   * Pixels a second that the whole conversion sustained on the slowest
   * machine measured, a 4-core Windows VM without a GPU, on 1080p.
   * Faster machines finish sooner, so the estimate errs long.
   */
  private static readonly PIXELS_PER_SECOND = 38_000_000;
  private static readonly OUTPUT_MIME_TYPE = 'video/mp4';

  constructor(
    private readonly decoder: SoftwareHevcDecoder,
    private readonly coordinator: MediaBunnyTranscodeCoordinator,
    private readonly codecPolicy: CodecPolicy,
    private readonly outputStrategyFactory: EncodedFileOutputStrategyFactory,
  ) {}

  async estimate(source: File): Promise<VideoConversionEstimate | null> {
    const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) return null;
      const stats = await track.computePacketStats(Infinity);
      const pixelsPerFrame = (await track.getDisplayWidth()) * (await track.getDisplayHeight());
      return { seconds: Math.ceil((stats.packetCount * pixelsPerFrame) / SoftwareHevcVideoConverter.PIXELS_PER_SECOND) };
    } catch (cause) {
      console.warn('[video-conversion] estimate failed', cause);
      return null;
    } finally {
      input.dispose();
    }
  }

  async convert(source: File, onProgress: (fraction: number) => void): Promise<File> {
    const strategy = this.outputStrategyFactory.create();
    try {
      await this.decoder.install();
      const converted = await this.transcode(source, strategy, onProgress);
      return new File([converted], this.convertedName(source.name), { type: SoftwareHevcVideoConverter.OUTPUT_MIME_TYPE });
    } catch (cause) {
      throw new VideoConversionFailedError({ cause });
    } finally {
      strategy.dispose();
    }
  }

  private async transcode(
    source: File,
    strategy: EncodedFileOutputStrategy,
    onProgress: (fraction: number) => void,
  ): Promise<Blob> {
    await this.coordinator.execute({
      source,
      codecPolicy: this.codecPolicy,
      painter: new SourceOnlyFramePainter(),
      outputFormat: 'mp4',
      outputStream: await strategy.open(SoftwareHevcVideoConverter.OUTPUT_MIME_TYPE),
      onProgress: (progress) => onProgress(progress.percent / 100),
      confirmFallbackDecoder: async () => false,
    });
    return strategy.collect();
  }

  /** Keeps the source's name, so the project it becomes is named the same: `IMG_0042.MOV` → `IMG_0042.mp4`. */
  private convertedName(sourceName: string): string {
    const dot = sourceName.lastIndexOf('.');
    return `${dot > 0 ? sourceName.slice(0, dot) : sourceName}.mp4`;
  }
}
