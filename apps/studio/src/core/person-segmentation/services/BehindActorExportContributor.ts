import type { Document, Segment } from '@tscaps/engine';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type {
  ExportRenderContext,
  ExportRenderContribution,
  ExportRenderContributor,
} from '@core/export/domain/ExportRenderContributor';
import type { BehindActorContributionBuilder } from '@core/person-segmentation/services/BehindActorContributionBuilder';
import type { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import type { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import type { IncrementalPersonSegmentationAnalyzer } from '@core/person-segmentation/services/IncrementalPersonSegmentationAnalyzer';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import { BehindActorMeasurementFailedError } from '@core/person-segmentation/domain/errors/BehindActorMeasurementFailedError';

/**
 * Contributes the text-behind-actor effect to an export, measuring
 * whatever the captions need that nobody has measured yet.
 *
 * Before deciding anything it finishes measuring every stretch the
 * captions sit on, then backfills mask gaps for force-on segments.
 * Both are best-effort: a failure logs and the export proceeds with
 * whatever the cache holds, rather than refusing to produce a file.
 *
 * The result is read through the same reader the preview gates on,
 * including on sessions whose result was never persisted, so the burn
 * matches what the editor showed.
 */
export class BehindActorExportContributor implements ExportRenderContributor {

  constructor(
    private readonly builder: BehindActorContributionBuilder,
    private readonly resultReader: PersonSegmentationResultReader,
    private readonly captionedRanges: CaptionedRangeCollector,
    private readonly analyzer: IncrementalPersonSegmentationAnalyzer,
    private readonly ensureSegmentMasks: EnsureSegmentMasksCachedAction,
    private readonly measurementReporter: NonBlockingFailureReporter,
  ) {}

  async prepare(context: ExportRenderContext): Promise<ExportRenderContribution> {
    await this.measureEveryCaption(context);
    let result = await this.loadResult(context.projectId);
    if (result !== null && await this.backfillForcedSegmentMasks(context.document, context.behindActorOverrides)) {
      result = await this.loadResult(context.projectId) ?? result;
    }
    return this.builder.build(context, result);
  }

  /**
   * Finishes measuring every stretch the captions sit on before
   * anything is decided.
   *
   * A burn cannot show a partial answer the way the preview can: a
   * stretch nobody measured comes out of the encoder without the
   * effect, and there is no second chance at it. So the background
   * pass is overtaken here rather than left to catch up.
   *
   * A stretch that still cannot be measured does not stop the export.
   * The preview held playback over that same stretch and gave up on it
   * too, so the file agrees with what the user watched — the effect is
   * off in both. What is left is telling them, which is why this
   * reports rather than refusing to produce a file.
   */
  private async measureEveryCaption(context: ExportRenderContext): Promise<void> {
    try {
      const covered = await this.analyzer.ensureCovered(
        this.captionedRanges.collect(context.document, context.sheets),
      );
      if (!covered) this.measurementReporter.report(new BehindActorMeasurementFailedError());
    } catch (error) {
      this.measurementReporter.report(new BehindActorMeasurementFailedError({ cause: error }));
    }
  }

  private async loadResult(projectId: string | null): Promise<PersonSegmentationResult | null> {
    try {
      return await this.resultReader.read(projectId);
    } catch (error) {
      console.error('[behind-actor] failed to load person-segmentation cache for export', error);
      return null;
    }
  }

  /**
   * Fills mask gaps for every force-on segment, and every segment
   * holding a force-on word, before the render starts — a forced one
   * outside the detector's windows has no masks from the initial scan
   * (or lost them to a re-scan on another device). A word is painted
   * for its whole segment, so its masks cover the segment's range.
   * Returns whether any backfill ran, so the cached result can be
   * reloaded with the merged masks.
   */
  private async backfillForcedSegmentMasks(doc: Document, behindActorOverrides: BehindActorOverrideRegistry): Promise<boolean> {
    let anyRan = false;
    for (const section of doc.sections) {
      for (const segment of section.segments) {
        if (!this.isForced(segment, behindActorOverrides)) continue;
        try {
          await this.ensureSegmentMasks.execute({
            segmentId: segment.id,
            range: { start: segment.time.start, end: segment.time.end },
          });
          anyRan = true;
        } catch (error) {
          console.error('[behind-actor] failed to backfill masks for forced segment', segment.id, error);
        }
      }
    }
    return anyRan;
  }

  private isForced(segment: Segment, behindActorOverrides: BehindActorOverrideRegistry): boolean {
    if (behindActorOverrides.get(segment.id) === 'force-on') return true;
    return segment.lines.some((line) => line.words.some((word) =>
      behindActorOverrides.get(word.id) === 'force-on'
      || (word.decoration !== null && behindActorOverrides.get(word.decoration.id) === 'force-on')));
  }
}
