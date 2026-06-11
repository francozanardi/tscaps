import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { CurrentFrameVideoSource } from '@modules/video/mediabunny/frame/CurrentFrameVideoSource';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';

/**
 * `SubtitleLayerSource` that publishes each decoded video frame into
 * a single-slot `VideoFrameSource` and asks the underlying renderer
 * for the matching caption tile, one render per call. The
 * `captionInterval` argument is unused; the cadence is whatever the
 * caller drives `frameAt` at.
 *
 * Picks the right strategy for sections whose stylesheets sample the
 * underlying video pixels (background-image filters, blur sourced
 * from the frame, etc.). The per-call render is expensive — use
 * only for the style subset that genuinely needs the sampling.
 */
export class VideoBoundSubtitleLayerSource implements SubtitleLayerSource {

  private videoFrameSource: CurrentFrameVideoSource | null = null;

  constructor(private readonly subtitleRenderer: SubtitleFrameRenderer) {}

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    _captionInterval: number,
  ): Promise<void> {
    this.videoFrameSource = new CurrentFrameVideoSource(width, height);
    await this.subtitleRenderer.open(doc, styles, width, height, this.videoFrameSource);
  }

  async frameAt(time: number, videoFrame: DecodedVideoFrame): Promise<SubtitleFrame | null> {
    if (!this.videoFrameSource) return null;
    // Publish before fetching: the renderer's stylesheets pull the
    // frame back through `videoFrameSource` while `getFrame` runs.
    this.videoFrameSource.setCurrent(time, videoFrame);
    return this.subtitleRenderer.getFrame(time);
  }

  close(): void {
    this.subtitleRenderer.close();
    this.videoFrameSource = null;
  }
}
