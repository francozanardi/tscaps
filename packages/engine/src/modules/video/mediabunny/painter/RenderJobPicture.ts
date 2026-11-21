import type { RenderFootage, RenderJob } from '@modules/video/RenderJob';
import type { RenderJobFramePainter } from '@modules/video/mediabunny/painter/RenderJobFramePainter';
import type { RenderJobFramePainterFactory } from '@modules/video/mediabunny/painter/RenderJobFramePainterFactory';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import { VideoFrameBackdrop } from '@modules/video/mediabunny/painter/VideoFrameBackdrop';
import { SolidColorFrameBackdrop } from '@modules/video/mediabunny/painter/SolidColorFrameBackdrop';
import { TransparentFrameBackdrop } from '@modules/video/mediabunny/painter/TransparentFrameBackdrop';

/** The fields of a {@link RenderJob} that say what each output frame looks like. */
export type RenderJobPictureFields = Pick<
  RenderJob,
  'document' | 'styles' | 'overlayHtml' | 'topLayer' | 'footage' | 'background' | 'frame'
>;

/**
 * What a render job asks each output frame to look like, as a painter
 * reads it: the backdrop its background names, and the footage drawn on
 * the source, where a frame of the job's own size with no footage still
 * needs the source's picture placed in it.
 *
 * Every renderer painting a job goes through here, so a job reads the
 * same whichever of them paints it.
 */
export class RenderJobPicture {

  /** Stateless, so one serves every frame of the job. */
  readonly backdrop: FrameBackdrop;

  constructor(private readonly job: RenderJobPictureFields) {
    this.backdrop = this.backdropFor(job.background ?? { kind: 'video' });
  }

  /** A fresh, unopened painter for this job, built by `factory`. */
  painterFrom(factory: RenderJobFramePainterFactory): RenderJobFramePainter {
    return factory.create(
      this.job.document,
      this.job.styles,
      this.job.overlayHtml,
      this.job.topLayer ?? null,
      this.backdrop,
      this.footage(),
    );
  }

  private footage(): RenderFootage | null {
    if (this.job.footage) return this.job.footage;
    if (!this.job.frame) return null;
    return { layers: [], style: { css: '', frameWidth: this.job.frame.width, frameHeight: this.job.frame.height } };
  }

  private backdropFor(background: NonNullable<RenderJob['background']>): FrameBackdrop {
    switch (background.kind) {
      case 'video': return new VideoFrameBackdrop();
      case 'color': return new SolidColorFrameBackdrop(background.color);
      case 'transparent': return new TransparentFrameBackdrop();
    }
  }
}
