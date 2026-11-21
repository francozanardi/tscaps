import type { RenderJob } from '@tscaps/engine';
import type { ExportRenderPlan } from '@core/export/services/ExportRenderPlanner';

/** The fields of a render job that say what its frames look like, as a plan fills them. */
export type ExportRenderJobPicture = Pick<
  RenderJob,
  'document' | 'styles' | 'overlayHtml' | 'topLayer' | 'footage' | 'frame' | 'skipRanges'
>;

/**
 * Turns a plan into the picture half of a render job, the same way for
 * every host that hands one to the engine, so a file and a still of the
 * same plan are painted from the same fields.
 */
export class ExportRenderJobBuilder {

  pictureOf(plan: ExportRenderPlan): ExportRenderJobPicture {
    return {
      document: plan.document,
      styles: plan.styles,
      ...(plan.overlayHtml ? { overlayHtml: plan.overlayHtml } : {}),
      ...(plan.topLayer ? { topLayer: plan.topLayer } : {}),
      ...(plan.footage === null ? {} : { footage: plan.footage }),
      ...(plan.frame === null ? {} : { frame: plan.frame }),
      ...(plan.skipRanges.length === 0 ? {} : { skipRanges: plan.skipRanges }),
    };
  }
}
