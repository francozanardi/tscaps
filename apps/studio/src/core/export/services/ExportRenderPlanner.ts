import type { Document, RenderAudioMix, RenderFootage, SubtitleStyle } from '@tscaps/engine';
import type { TopLayerSource } from '@tscaps/engine/advanced';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRange, CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { ExportRenderContribution, ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
import type { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

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
  readonly footage: RenderFootage | null;
  /** Files a footage layer was meant to show that could not be had; the render goes on without them. */
  readonly unavailableFootage: ReadonlyArray<string>;
  /** What is mixed with the video's own sound, or null for nothing. */
  readonly audioMix: RenderAudioMix | null;
  /** Sound files the mix was meant to play that could not be had; the render goes on without them. */
  readonly unavailableAudio: ReadonlyArray<string>;
  /**
   * What each layer of `audioMix` plays, by layer id, named as
   * `unavailableAudio` names a file. A layer left unnamed is one the
   * render goes without unasked when it cannot be decoded.
   */
  readonly audioLayerFileNames: ReadonlyMap<string, string>;
  readonly overlayHtml: string | null;
  readonly skipRanges: readonly CutRange[];
  /** The output frame's size where it is not the video's own, or null where the video keeps its size. */
  readonly frame: VideoLayout | null;
}

export interface ExportRenderPlanRequest {
  readonly document: Document;
  /** The Original track's document, whatever caption track is active; what the soundtrack's word anchors read. */
  readonly originalDocument: Document | null;
  /** The sheets the Original track's sections route to, and its emoji edits: which of its emojis show, for the soundtrack's emoji anchors. */
  readonly originalSheets: ReadonlyArray<Sheet>;
  readonly originalDecorationOverrides: DecorationOverrideRegistry;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly elementStyles: ElementStyles;
  readonly decorationOverrides: DecorationOverrideRegistry;
  readonly cuts: CutRegistry;
  readonly behindActorOverrides: BehindActorOverrideRegistry;
  readonly projectId: string | null;
  /** The output frame's size, which captions and shot layers are laid out on, or null when that is not known. */
  readonly frameLayout: VideoLayout | null;
  readonly outputFrame: OutputFrame;
  readonly colorGrade: ColorGrade;
  readonly shots: ShotPartition;
  readonly media: MediaAssetCatalog;
  /** The soundtrack the render carries: the project's, or the empty mix when it leaves the sound out. */
  readonly audio: AudioMix;
  readonly videoDurationSec: number | null;
  /** Aborts when the run is abandoned; handed to every contributor, which stops waiting on it. */
  readonly signal: AbortSignal;
}

/**
 * Turns a project into what a render burns and mixes: the document as it
 * will be burned, one style per sheet, whatever a contributor paints on
 * top or mixes with the video's sound, and the ranges the output leaves
 * out.
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
      footage: contribution.footage,
      unavailableFootage: contribution.unavailableFootage,
      audioMix: contribution.audioMix,
      unavailableAudio: contribution.unavailableAudio,
      audioLayerFileNames: contribution.audioLayerFileNames,
      overlayHtml: this.resolveOverlayHtml(request),
      skipRanges: request.cuts.list(),
      frame: request.outputFrame.isOriginal() ? null : request.frameLayout,
    };
  }

  private resolveOverlayHtml(request: ExportRenderPlanRequest): string | null {
    const layout = request.frameLayout;
    if (!layout) return null;
    return this.overlayHtmlProvider?.({
      projectId: request.projectId,
      videoWidth: layout.width,
      videoHeight: layout.height,
    }) ?? null;
  }

  /**
   * Runs every render contributor against the same context and merges
   * the results: per-segment classes and unavailable files are
   * concatenated in contributor order, the elements under the top layer
   * are pooled, and at most one contributor may supply a top layer,
   * footage or an audio mix — a second one is a programming error in the
   * composition root.
   */
  private async prepareRenderContribution(
    document: Document,
    request: ExportRenderPlanRequest,
  ): Promise<ExportRenderContribution> {
    const segmentClasses = new Map<string, ReadonlyArray<string>>();
    const elementsUnderTopLayer = new Set<string>();
    let topLayer: TopLayerSource | null = null;
    let footage: RenderFootage | null = null;
    let audioMix: RenderAudioMix | null = null;
    const unavailableFootage: string[] = [];
    const unavailableAudio: string[] = [];
    const audioLayerFileNames = new Map<string, string>();
    for (const contributor of this.renderContributors) {
      const contribution = await contributor.prepare({
        document,
        originalDocument: request.originalDocument,
        originalSheets: request.originalSheets,
        originalDecorationOverrides: request.originalDecorationOverrides,
        sheets: [...request.sheets],
        behindActorOverrides: request.behindActorOverrides,
        projectId: request.projectId,
        shots: request.shots,
        media: request.media,
        cuts: request.cuts,
        audio: request.audio,
        videoDurationSec: request.videoDurationSec,
        frameLayout: request.frameLayout,
        outputFrame: request.outputFrame,
        colorGrade: request.colorGrade,
        signal: request.signal,
      });
      if (contribution.footage !== null) {
        if (footage !== null) throw new Error('Multiple export render contributors supplied footage.');
        footage = contribution.footage;
      }
      if (contribution.audioMix !== null) {
        if (audioMix !== null) throw new Error('Multiple export render contributors supplied an audio mix.');
        audioMix = contribution.audioMix;
      }
      unavailableFootage.push(...contribution.unavailableFootage);
      unavailableAudio.push(...contribution.unavailableAudio);
      for (const [layerId, fileName] of contribution.audioLayerFileNames) audioLayerFileNames.set(layerId, fileName);
      for (const [segmentId, classes] of contribution.segmentClasses) {
        segmentClasses.set(segmentId, [...(segmentClasses.get(segmentId) ?? []), ...classes]);
      }
      for (const elementId of contribution.elementsUnderTopLayer) elementsUnderTopLayer.add(elementId);
      if (contribution.topLayer !== null) {
        if (topLayer !== null) throw new Error('Multiple export render contributors supplied a top layer.');
        topLayer = contribution.topLayer;
      }
    }
    return { segmentClasses, topLayer, elementsUnderTopLayer, footage, unavailableFootage, audioMix, unavailableAudio, audioLayerFileNames };
  }
}
