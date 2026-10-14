import type { Document, SubtitleStyle, TopLayerSource } from '@tscaps/engine';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRange, CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ExportRenderContribution, ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
import type { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';

export interface ExportOverlayHtmlContext {
  readonly projectId: string | null;
  readonly videoWidth: number;
  readonly videoHeight: number;
}

export type ExportOverlayHtmlProvider = (context: ExportOverlayHtmlContext) => string | null;

/** Everything a render needs that is derived from the project rather than chosen by the user. */
export interface ExportRenderPlan {
  readonly document: Document;
  readonly styles: Record<string, SubtitleStyle>;
  readonly topLayer: TopLayerSource | null;
  readonly overlayHtml: string | null;
  readonly skipRanges: readonly CutRange[];
}

export interface ExportRenderPlanRequest {
  readonly document: Document;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly elementStyles: ElementStyles;
  readonly decorationOverrides: DecorationOverrideRegistry;
  readonly cuts: CutRegistry;
  readonly behindActorOverrides: BehindActorOverrideRegistry;
  readonly projectId: string | null;
  readonly videoLayout: VideoLayout | null;
}

/**
 * Turns a project into the picture side of a render: the document as it
 * will be burned, one style per sheet, whatever a contributor paints on
 * top, and the ranges the output leaves out.
 *
 * Holds no opinion on where the bytes go or how the run is reported, so
 * the same plan serves any host that can drive the renderer.
 */
export class ExportRenderPlanner {

  constructor(
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder,
    private readonly decorationFilter: DecorationFilter,
    private readonly styleSetBuilder: SubtitleStyleSetBuilder,
    private readonly renderContributors: ReadonlyArray<ExportRenderContributor>,
    private readonly overlayHtmlProvider?: ExportOverlayHtmlProvider,
  ) {}

  async plan(request: ExportRenderPlanRequest): Promise<ExportRenderPlan> {
    const visibleDoc = this.cutAwareDocumentBuilder.build(request.document, request.cuts);
    const renderDocument = this.decorationFilter.filterDocument(visibleDoc, request.sheets, request.decorationOverrides);
    const contribution = await this.prepareRenderContribution(renderDocument, request);
    return {
      document: renderDocument,
      styles: this.styleSetBuilder.build({
        sourceDocument: request.document,
        renderDocument,
        sheets: request.sheets,
        elementStyles: request.elementStyles,
        contributedSegmentClasses: contribution.segmentClasses,
        elementsUnderTopLayer: contribution.elementsUnderTopLayer,
      }),
      topLayer: contribution.topLayer,
      overlayHtml: this.resolveOverlayHtml(request),
      skipRanges: request.cuts.list(),
    };
  }

  private resolveOverlayHtml(request: ExportRenderPlanRequest): string | null {
    const layout = request.videoLayout;
    if (!layout) return null;
    return this.overlayHtmlProvider?.({
      projectId: request.projectId,
      videoWidth: layout.width,
      videoHeight: layout.height,
    }) ?? null;
  }

  /**
   * Runs every render contributor against the same context and merges
   * the results: per-segment classes are concatenated in contributor
   * order, the elements under the top layer are pooled, and at most one
   * contributor may supply a top layer — a second one is a programming
   * error in the composition root.
   */
  private async prepareRenderContribution(
    document: Document,
    request: ExportRenderPlanRequest,
  ): Promise<ExportRenderContribution> {
    const segmentClasses = new Map<string, ReadonlyArray<string>>();
    const elementsUnderTopLayer = new Set<string>();
    let topLayer: TopLayerSource | null = null;
    for (const contributor of this.renderContributors) {
      const contribution = await contributor.prepare({
        document,
        sheets: [...request.sheets],
        behindActorOverrides: request.behindActorOverrides,
        projectId: request.projectId,
      });
      for (const [segmentId, classes] of contribution.segmentClasses) {
        segmentClasses.set(segmentId, [...(segmentClasses.get(segmentId) ?? []), ...classes]);
      }
      for (const elementId of contribution.elementsUnderTopLayer) elementsUnderTopLayer.add(elementId);
      if (contribution.topLayer !== null) {
        if (topLayer !== null) throw new Error('Multiple export render contributors supplied a top layer.');
        topLayer = contribution.topLayer;
      }
    }
    return { segmentClasses, topLayer, elementsUnderTopLayer };
  }
}
