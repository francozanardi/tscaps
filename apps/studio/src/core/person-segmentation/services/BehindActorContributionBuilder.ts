import type { Document, TimeFragment } from '@tscaps/engine';
import { CssClass } from '@tscaps/engine';
import type { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { ExportRenderContext, ExportRenderContribution } from '@core/export/domain/ExportRenderContributor';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { ActorMaskTopLayerSource } from '@core/person-segmentation/infrastructure/ActorMaskTopLayerSource';

/**
 * Turns one detector result into what the render needs from the
 * text-behind-actor effect: the activation class on every segment the
 * effect is on, the words under the actor in a scene that is not, and
 * the actor cutout over the time ranges of every segment holding any.
 *
 * Holds no opinion on where the result came from, so a host that
 * measured the video itself and a host that was handed the measurement
 * reach the same picture from the same record. That is the whole point
 * of it being one class: two ways of deciding would be two answers.
 */
export class BehindActorContributionBuilder {

  /** Nothing on any segment and nothing painted over the captions. */
  static readonly NOTHING: ExportRenderContribution = {
    segmentClasses: new Map<string, ReadonlyArray<string>>(),
    topLayer: null,
    elementsUnderTopLayer: new Set<string>(),
  };

  constructor(private readonly gatingService: BehindActorGatingService) {}

  /**
   * Contributes nothing for a `null` result: without masks the effect
   * cannot composite, and publishing the class alone would move the
   * caption without the occlusion that justifies the move.
   */
  build(context: ExportRenderContext, result: PersonSegmentationResult | null): ExportRenderContribution {
    if (result === null) return BehindActorContributionBuilder.NOTHING;
    const activeSegmentIds = this.gatingService.buildActiveSegmentIds(
      context.document,
      result.windows,
      context.behindActorOverrides.all(),
      this.templateConfigBySectionKind(context),
    );
    const activeElementIds = this.gatingService.buildActiveElementIds(
      context.document,
      context.behindActorOverrides.all(),
      activeSegmentIds,
    );
    const partialSegmentIds = this.collectSegmentsHolding(context.document, activeElementIds);
    return {
      segmentClasses: this.buildSegmentClasses(activeSegmentIds, partialSegmentIds),
      // A word or glyph behind the actor is painted for its whole scene,
      // so the actor is cut out over the scene's range, not only its own.
      topLayer: new ActorMaskTopLayerSource(
        result.maskCache,
        this.collectActiveRanges(context.document, new Set([...activeSegmentIds, ...partialSegmentIds])),
      ),
      elementsUnderTopLayer: activeElementIds,
    };
  }

  private collectSegmentsHolding(document: Document, elementIds: ReadonlySet<string>): ReadonlySet<string> {
    const segmentIds = new Set<string>();
    if (elementIds.size === 0) return segmentIds;
    for (const segment of document.getSegments()) {
      const holds = segment.lines.some((line) => line.words.some((word) =>
        elementIds.has(word.id) || (word.decoration !== null && elementIds.has(word.decoration.id))));
      if (holds) segmentIds.add(segment.id);
    }
    return segmentIds;
  }

  private templateConfigBySectionKind(context: ExportRenderContext): ReadonlyMap<string, BehindActorTemplateConfig> {
    return new Map(context.sheets.map((sheet) => [sheet.id, sheet.template.behindActor]));
  }

  private buildSegmentClasses(
    activeSegmentIds: ReadonlySet<string>,
    partialSegmentIds: ReadonlySet<string>,
  ): ReadonlyMap<string, ReadonlyArray<string>> {
    const classes = new Map<string, ReadonlyArray<string>>();
    for (const segmentId of activeSegmentIds) classes.set(segmentId, [CssClass.BEHIND_ACTOR_ACTIVE]);
    for (const segmentId of partialSegmentIds) classes.set(segmentId, [CssClass.BEHIND_ACTOR_PARTIAL]);
    return classes;
  }

  private collectActiveRanges(document: Document, activeSegmentIds: ReadonlySet<string>): TimeFragment[] {
    const ranges: TimeFragment[] = [];
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (activeSegmentIds.has(segment.id)) ranges.push(segment.time);
      }
    }
    return ranges;
  }
}
