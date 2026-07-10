import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { CodecPolicy, MediaBunnyTranscodeCoordinator } from '@tscaps/engine';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type {
  PreviewProxyGenerator,
  PreviewProxyProgressCallback,
} from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyOutputStrategy } from '@core/preview/domain/PreviewProxyOutputStrategy';
import type { PreviewProxyOutputStrategyFactory } from '@core/preview/domain/PreviewProxyOutputStrategyFactory';
import { PreviewProxyGenerationFailedError } from '@core/preview/domain/errors/PreviewProxyGenerationFailedError';
import { SourceOnlyFramePainter } from '@core/preview/infrastructure/mediabunny/SourceOnlyFramePainter';

interface ProxyDimensions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Browser-side proxy generator.
 *
 * Video is always resized to a short-edge of 480 px and re-encoded to
 * H.264 at a low bitrate so the editor's preview decoder runs cheap on
 * every input. Never upscales: when the source is already smaller than
 * the target, the original dimensions are kept. Audio passthrough /
 * transcode is decided by the shared coordinator's audio bridge.
 *
 * Any underlying mediabunny / WebCodecs failure is wrapped in
 * `PreviewProxyGenerationFailedError` so callers can tell proxy
 * failures apart from generic errors.
 */
export class MediaBunnyPreviewProxyGenerator implements PreviewProxyGenerator {

  private static readonly TARGET_SHORT_EDGE_PX = 480;
  private static readonly OUTPUT_MIME_TYPE = 'video/mp4';
  private static readonly OUTPUT_FORMAT = 'mp4';
  private static readonly SOURCE_FALLBACK_FILENAME = 'preview-proxy-source';

  constructor(
    private readonly outputStrategyFactory: PreviewProxyOutputStrategyFactory,
    private readonly coordinator: MediaBunnyTranscodeCoordinator,
    private readonly codecPolicy: CodecPolicy,
  ) {}

  async generate(source: Blob, onProgress?: PreviewProxyProgressCallback): Promise<PreviewProxy> {
    const strategy = this.outputStrategyFactory.create();
    try {
      return await this.runGeneration(source, onProgress, strategy);
    } catch (cause) {
      throw new PreviewProxyGenerationFailedError({ cause });
    } finally {
      strategy.dispose();
    }
  }

  private async runGeneration(
    source: Blob,
    onProgress: PreviewProxyProgressCallback | undefined,
    strategy: PreviewProxyOutputStrategy,
  ): Promise<PreviewProxy> {
    const sourceFile = this.toFile(source);
    const dimensions = await this.readTargetDimensions(sourceFile);
    const outputStream = await strategy.open(MediaBunnyPreviewProxyGenerator.OUTPUT_MIME_TYPE);
    const result = await this.coordinator.execute({
      source: sourceFile,
      codecPolicy: this.codecPolicy,
      painter: new SourceOnlyFramePainter(),
      outputResolution: { width: dimensions.widthPx, height: dimensions.heightPx },
      outputFormat: MediaBunnyPreviewProxyGenerator.OUTPUT_FORMAT,
      outputStream,
      ...(onProgress ? { onProgress: (p) => onProgress(p.percent / 100) } : {}),
    });
    return {
      blob: await strategy.collect(),
      mimeType: MediaBunnyPreviewProxyGenerator.OUTPUT_MIME_TYPE,
      widthPx: result.width,
      heightPx: result.height,
    };
  }

  private async readTargetDimensions(source: File): Promise<ProxyDimensions> {
    const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error('Input has no video track');
    }
    const [sourceWidth, sourceHeight] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
    ]);
    return this.fitToShortEdge(sourceWidth, sourceHeight);
  }

  private fitToShortEdge(sourceWidth: number, sourceHeight: number): ProxyDimensions {
    const targetShortEdge = MediaBunnyPreviewProxyGenerator.TARGET_SHORT_EDGE_PX;
    if (sourceWidth >= sourceHeight) {
      const aspectRatio = sourceWidth / sourceHeight;
      const height = Math.min(targetShortEdge, sourceHeight);
      const width = Math.min(Math.round(height * aspectRatio), sourceWidth);
      return { widthPx: width, heightPx: height };
    }
    const aspectRatio = sourceHeight / sourceWidth;
    const width = Math.min(targetShortEdge, sourceWidth);
    const height = Math.min(Math.round(width * aspectRatio), sourceHeight);
    return { widthPx: width, heightPx: height };
  }

  /**
   * Wraps a bare `Blob` in a `File` when necessary. The decoder
   * factory's fallback path (used when WebCodecs cannot decode the
   * source codec) reads bytes from a `File`, not a bare `Blob`.
   */
  private toFile(source: Blob): File {
    if (source instanceof File) return source;
    return new File(
      [source],
      MediaBunnyPreviewProxyGenerator.SOURCE_FALLBACK_FILENAME,
      { type: source.type || MediaBunnyPreviewProxyGenerator.OUTPUT_MIME_TYPE },
    );
  }
}
