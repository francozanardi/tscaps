import type { VideoRenderer } from '@modules/video/VideoRenderer';
import type { RenderBackground, RenderJob, RenderResult, RenderProgress } from '@modules/video/RenderJob';
import { RenderTimeMap } from '@modules/video/RenderTimeMap';
import type { CodecPolicy } from '@modules/video/mediabunny/codec/CodecPolicy';
import type { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
import type { CaptionsOverlayFramePainterFactory } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainterFactory';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import { VideoFrameBackdrop } from '@modules/video/mediabunny/painter/VideoFrameBackdrop';
import { SolidColorFrameBackdrop } from '@modules/video/mediabunny/painter/SolidColorFrameBackdrop';
import { TransparentFrameBackdrop } from '@modules/video/mediabunny/painter/TransparentFrameBackdrop';

export interface MediaBunnyVideoRendererConfig {
  coordinator: MediaBunnyTranscodeCoordinator;
  codecPolicy: CodecPolicy;
  painterFactory: CaptionsOverlayFramePainterFactory;
}

/**
 * Renders a {@link RenderJob} through the mediabunny transcode
 * coordinator. Owns the caption/overlay side of the pipeline — the
 * document, style set, overlay HTML, and skip ranges from the job are
 * translated into a painter and a time map that the coordinator drives.
 * Encoding, containerization, and audio handling live in the
 * coordinator.
 *
 * One job at a time per instance: concurrent {@link render} calls on
 * the same instance are not supported.
 */
export class MediaBunnyVideoRenderer implements VideoRenderer {

  private readonly coordinator: MediaBunnyTranscodeCoordinator;
  private readonly codecPolicy: CodecPolicy;
  private readonly painterFactory: CaptionsOverlayFramePainterFactory;

  constructor(config: MediaBunnyVideoRendererConfig) {
    this.coordinator = config.coordinator;
    this.codecPolicy = config.codecPolicy;
    this.painterFactory = config.painterFactory;
  }

  async render(
    job: RenderJob,
    onProgress?: (progress: RenderProgress) => void,
  ): Promise<RenderResult> {
    const backdrop = this.backdropFor(job.background ?? { kind: 'video' });
    const painter = this.painterFactory.create(
      job.document,
      job.styles,
      job.overlayHtml,
      job.topLayer ?? null,
      backdrop,
    );
    const timeMap = new RenderTimeMap(job.skipRanges ?? []);
    const result = await this.coordinator.execute({
      source: job.video,
      codecPolicy: this.codecPolicy,
      painter,
      timeMap,
      alpha: backdrop.isTransparent(),
      sourcePixels: backdrop.showsFramePixels(),
      ...(job.audio ? { audio: job.audio } : {}),
      ...(job.outputResolution ? { outputResolution: job.outputResolution } : {}),
      ...(job.outputFormat ? { outputFormat: job.outputFormat } : {}),
      ...(job.quality ? { quality: job.quality } : {}),
      ...(job.outputStream ? { outputStream: job.outputStream } : {}),
      ...(job.signal ? { signal: job.signal } : {}),
      ...(onProgress ? { onProgress } : {}),
      ...(job.onAudioDiscarded ? { onAudioDiscarded: job.onAudioDiscarded } : {}),
      ...(job.confirmFallbackDecoder ? { confirmFallbackDecoder: job.confirmFallbackDecoder } : {}),
      ...(job.onVideoFrameDecoderSelected ? { onVideoFrameDecoderSelected: job.onVideoFrameDecoderSelected } : {}),
    });
    return { blob: result.blob, mimeType: result.mimeType };
  }

  private backdropFor(background: RenderBackground): FrameBackdrop {
    switch (background.kind) {
      case 'video': return new VideoFrameBackdrop();
      case 'color': return new SolidColorFrameBackdrop(background.color);
      case 'transparent': return new TransparentFrameBackdrop();
    }
  }
}
