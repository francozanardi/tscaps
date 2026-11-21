import type {
  ExportRenderContext,
  ExportRenderContribution,
  ExportRenderContributor,
} from '@core/export/domain/ExportRenderContributor';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { BehindActorContributionBuilder } from '@core/person-segmentation/services/BehindActorContributionBuilder';
import type { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';

/**
 * Contributes the text-behind-actor effect from what has been measured
 * so far, and measures nothing: no analysis is started, and no mask gap
 * is filled. Where nothing has been measured yet the effect is off,
 * which is what the preview shows there too.
 *
 * For a render that has to answer at once, such as a single frame, where
 * waiting on the detector would cost seconds or minutes. A file meant to
 * be kept goes through the contributor that finishes measuring first.
 */
export class CachedBehindActorExportContributor implements ExportRenderContributor {

  constructor(
    private readonly builder: BehindActorContributionBuilder,
    private readonly resultReader: PersonSegmentationResultReader,
  ) {}

  async prepare(context: ExportRenderContext): Promise<ExportRenderContribution> {
    return this.builder.build(context, await this.cachedResult(context.projectId));
  }

  private async cachedResult(projectId: string | null): Promise<PersonSegmentationResult | null> {
    try {
      return await this.resultReader.read(projectId);
    } catch (error) {
      console.error('[behind-actor] failed to load the person-segmentation cache', error);
      return null;
    }
  }
}
