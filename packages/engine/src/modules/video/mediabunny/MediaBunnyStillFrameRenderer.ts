import { ALL_FORMATS, BlobSource, Input, type InputVideoTrack } from 'mediabunny';
import { RenderTimeMap } from '@modules/video/RenderTimeMap';
import type { StillFrameJob, StillFrameRenderer } from '@modules/video/StillFrameRenderer';
import type { StillFrameSession } from '@modules/video/StillFrameSession';
import type { RenderJobFramePainterFactory } from '@modules/video/mediabunny/painter/RenderJobFramePainterFactory';
import { RenderJobPicture } from '@modules/video/mediabunny/painter/RenderJobPicture';
import { RenderOutputDimensions } from '@modules/video/mediabunny/output/RenderOutputDimensions';
import { SourceFrameRateReader } from '@modules/video/mediabunny/frame/SourceFrameRateReader';
import { ShownSourceFrameSeeker } from '@modules/video/mediabunny/frame/ShownSourceFrameSeeker';
import { OutputFrameCanvas } from '@modules/video/mediabunny/encoder/OutputFrameCanvas';
import { MediaBunnyStillFrameSession } from '@modules/video/mediabunny/MediaBunnyStillFrameSession';

export interface MediaBunnyStillFrameRendererConfig {
  /**
   * Builds each session's painter. Its caption sources must answer
   * moments in any order, as a `BrowserRandomAccessSubtitleLayerSourceFactory`
   * builds them; sources that walk forward through time paint an earlier
   * moment wrong.
   */
  painterFactory: RenderJobFramePainterFactory;
}

/**
 * {@link StillFrameRenderer} that paints a job's output frames the way
 * `MediaBunnyVideoRenderer` paints them for a render: the job read by
 * the same rules, the painter begun with the output size and frame rate
 * the render would resolve, each input frame found by the render's own
 * rule for which frames it keeps, and the paint run on a canvas set up as
 * the encoder's is. The input is decoded through WebCodecs, whatever the
 * background, so an input this browser cannot decode is refused.
 *
 * A job's top layer and footage are asked for moments in the order the
 * session is asked, so they must answer any order.
 */
export class MediaBunnyStillFrameRenderer implements StillFrameRenderer {

  private readonly painterFactory: RenderJobFramePainterFactory;

  constructor(config: MediaBunnyStillFrameRendererConfig) {
    this.painterFactory = config.painterFactory;
  }

  async open(job: StillFrameJob): Promise<StillFrameSession> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(job.video) });
    try {
      return await this.openOn(input, job);
    } catch (error) {
      input.dispose();
      throw error;
    }
  }

  private async openOn(input: Input, job: StillFrameJob): Promise<StillFrameSession> {
    const track = await this.decodableTrackOf(input);
    const display = { width: track.displayWidth, height: track.displayHeight };
    const { width, height } = new RenderOutputDimensions().resolve(job.frame ?? display, undefined);
    const fps = await new SourceFrameRateReader().read(track);
    const picture = new RenderJobPicture(job);
    const painter = picture.painterFrom(this.painterFactory);
    try {
      await painter.begin(width, height, fps, display.width, display.height);
    } catch (error) {
      painter.end();
      throw error;
    }
    const timeMap = new RenderTimeMap(job.skipRanges ?? []);
    return new MediaBunnyStillFrameSession(
      input,
      new ShownSourceFrameSeeker(track, timeMap),
      painter,
      timeMap,
      new OutputFrameCanvas(width, height, picture.backdrop.isTransparent()),
    );
  }

  private async decodableTrackOf(input: Input): Promise<InputVideoTrack> {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('No video track found in the input file');
    if (!(await track.canDecode())) {
      throw new Error(`This browser cannot decode the input's video (${await track.getCodec() ?? 'unknown codec'}).`);
    }
    return track;
  }
}
