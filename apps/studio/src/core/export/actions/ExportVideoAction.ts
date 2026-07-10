import type { Document, DecorationPlacementSide, VideoRenderer, SubtitleStyle, OutputFormat, RenderQuality, ScopedRenderOverride, AudioDiscardReason } from '@tscaps/engine';
import { ElementRenderOverrides, SvgFilterBundle } from '@tscaps/engine';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import type { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import type { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { InlineStyleMap } from '@tscaps/engine';
import type { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import type { EnsureSegmentMasksCachedAction } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { ActorMaskTopLayerSource } from '@core/person-segmentation/infrastructure/ActorMaskTopLayerSource';
import { BEHIND_ACTOR_LIFT_CSS } from '@core/person-segmentation/domain/BehindActorLiftCss';
import type { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import { AppError } from '@core/_shared/domain/AppError';
import { ExportFailedError } from '@core/export/domain/ExportFailedError';

/**
 * Target output dimensions chosen by the user. `'original'` means
 * "keep the source resolution"; an explicit `{ width, height }` value
 * triggers a downscale in the renderer (it never upscales beyond the
 * source).
 */
export type ExportResolution = 'original' | { width: number; height: number };

export interface ExportVideoOptions {
  format: OutputFormat;
  quality: RenderQuality;
  resolution: ExportResolution;
}

export interface ExportOverlayHtmlContext {
  readonly projectId: string | null;
  readonly videoWidth: number;
  readonly videoHeight: number;
}

export type ExportOverlayHtmlProvider = (context: ExportOverlayHtmlContext) => string | null;

/**
 * Burns subtitles into the video. Each Sheet is mapped to a `SubtitleStyle`
 * keyed by sheet id; the renderer dispatches per-frame to the entry
 * matching the active Section's `kind`.
 *
 * The export SVG runs in an isolated CSS context that can't see the host
 * page's stylesheets, so for each sheet the action looks up the font
 * family it uses, asks the `FontFaceCssReader` for the matching
 * `@font-face` declarations, and prepends those to the sheet's own CSS —
 * the engine's renderer then inlines the referenced woff2 files as data
 * URIs.
 *
 * Named *VideoAction* to disambiguate from `ExportProjectAction` (which
 * exports the project metadata as a `.tscaps` file).
 */
export class ExportVideoAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly downloadStore: OriginalVideoDownloadStore,
    private readonly renderer: VideoRenderer,
    private readonly sheetCssVarsBuilder: SheetCssVarsBuilder,
    private readonly segmentColorRotation: SegmentColorRotation,
    private readonly fontFaceCssBuilder: FontFaceCssBuilder,
    private readonly sheetFontFamilyCollector: SheetFontFamilyCollector,
    private readonly documentUsedCodepointCollector: DocumentUsedCodepointCollector,
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
    private readonly decorationPlacementResolver: DecorationPlacementResolver,
    private readonly decorationFilter: DecorationFilter,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly telemetry: Telemetry,
    private readonly customizationDiff: SheetCustomizationDiff,
    private readonly behindActorGatingService: BehindActorGatingService,
    private readonly personSegmentationCache: PersonSegmentationCacheRepository,
    private readonly ensureSegmentMasks: EnsureSegmentMasksCachedAction,
    private readonly overlayHtmlProvider?: ExportOverlayHtmlProvider,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const { video, document: subtitleDoc, sheets, projectId, wordStyleOverrides, segmentOverrides, decorationOverrides, cuts } = this.editorStore.snapshot();
    const videoLayout = video.layout;
    if (!subtitleDoc || sheets.length === 0 || video.fileName === null) return;

    const visibleDoc = this.cutAwareDocumentBuilder.build(subtitleDoc, cuts);
    const renderDoc = this.decorationFilter.filterDocument(visibleDoc, sheets, decorationOverrides);
    const wordOverridesBySheet = this.collectWordOverrides(renderDoc, wordStyleOverrides);
    const decorationPlacementsBySheet = this.collectDecorationPlacements(renderDoc, sheets);
    const usedCodepoints = this.documentUsedCodepointCollector.collect(renderDoc);
    let personSegmentation = await this.loadPersonSegmentationResult(projectId);
    if (personSegmentation !== null && await this.backfillForcedSegmentMasks(renderDoc, segmentOverrides)) {
      personSegmentation = await this.loadPersonSegmentationResult(projectId) ?? personSegmentation;
    }
    // Without a detector result there are no masks to composite, so the
    // effect stays fully off — publishing forced vars would move the
    // caption without the occlusion that justifies the move.
    const behindActorVars = personSegmentation
      ? this.behindActorGatingService.buildSegmentInlineVars(
          renderDoc,
          personSegmentation.windows,
          segmentOverrides.behindActorOverrides(),
        )
      : new Map<string, InlineStyleMap>();

    const styles: Record<string, SubtitleStyle> = {};
    for (const sheet of sheets) {
      const inlineStyles = this.sheetCssVarsBuilder.build(sheet);
      const sheetCss = sheet.resolveCss();
      const families = this.sheetFontFamilyCollector.collect({
        sheet,
        document: subtitleDoc,
        inlineStyles,
        sheetCss,
        wordOverrides: wordStyleOverrides,
        segmentOverrides,
      });
      const fontFaces = this.fontFaceCssBuilder.build(families, usedCodepoints);
      const webRendering = sheet.template.rendering;
      const liftCss = webRendering.behindActor.required ? `\n${BEHIND_ACTOR_LIFT_CSS}` : '';
      styles[sheet.id] = {
        css: `${fontFaces ? `${fontFaces}\n${sheetCss}` : sheetCss}${liftCss}`,
        inlineStyles,
        alignment: sheet.alignmentConfig,
        rendering: {
          splitWordsIntoLetters: webRendering.splitWordsIntoLetters,
          videoFrame: {
            required: webRendering.videoFrame.required,
            jpegQuality: webRendering.videoFrame.jpegQuality,
          },
          padding: webRendering.padding,
          behindActor: { required: webRendering.behindActor.required },
        },
        wordOverrides: wordOverridesBySheet[sheet.id] ?? ElementRenderOverrides.empty(),
        segmentOverrides: this.collectSegmentOverrides(subtitleDoc, sheet, segmentOverrides, behindActorVars),
        svgFilters: new SvgFilterBundle(this.svgFilterDefinitionsResolver.resolve(sheet), new SheetSvgFilterScopeProvider(sheet)),
        decorationPlacements: decorationPlacementsBySheet[sheet.id] ?? new Map<string, DecorationPlacementSide>(),
      };
    }

    // Open the writer before the heavy work: if the user cancels an
    // interactive prompt we abort without spending any encoding time.
    const writer = await this.openWriter(options.format);
    if (!writer) return;

    await this.persistBeforeRender();

    this.progressStore.reset();
    const initialPhase = video.file !== null ? 'rendering' : 'awaiting-original';
    this.exportStore.start(initialPhase);
    this.editorStore.patch({ error: null });

    const overlayHtml = videoLayout
      ? this.overlayHtmlProvider?.({
          projectId,
          videoWidth: videoLayout.width,
          videoHeight: videoLayout.height,
        }) ?? null
      : null;

    let audioDiscardedReason: AudioDiscardReason | null = null;
    console.time('[export] total');
    const startedAt = performance.now();
    this.telemetry.capture('export_started', {
      format: options.format,
      quality: options.quality,
      resolution: this.describeResolution(options.resolution),
    });
    this.captureTemplateUsageAtExport(sheets);
    try {
      const videoFile = await this.resolveOriginalVideoFile(video.file);
      const topLayer = personSegmentation ? new ActorMaskTopLayerSource(personSegmentation.maskCache) : undefined;
      await this.renderer.render(
        {
          video: videoFile,
          document: renderDoc,
          styles,
          ...(overlayHtml ? { overlayHtml } : {}),
          ...(topLayer ? { topLayer } : {}),
          outputFormat: options.format,
          quality: options.quality,
          ...(options.resolution !== 'original' ? { outputResolution: options.resolution } : {}),
          outputStream: writer.stream(),
          ...(cuts.isEmpty() ? {} : { skipRanges: cuts.list() }),
          confirmFallbackDecoder: (info) => this.exportPauseCoordinator.pauseAndAwait({
            kind: 'fallback-decoder',
            codec: info.inputCodec,
          }),
          onAudioDiscarded: (reason) => { audioDiscardedReason = reason; },
        },
        (p) => this.updateProgress(p.percent),
      );

      const file = await writer.finalize();
      if (file) this.triggerDownload(file, options.format);

      this.exportStore.finish(
        audioDiscardedReason !== null
          ? { kind: 'audio-discarded', reason: audioDiscardedReason }
          : null,
      );
      this.telemetry.capture('export_completed', {
        format: options.format,
        quality: options.quality,
        resolution: this.describeResolution(options.resolution),
        elapsed_ms: Math.round(performance.now() - startedAt),
        audio_discarded: audioDiscardedReason !== null,
      });
    } catch (err) {
      await writer.abort();
      const isCanceled = err instanceof Error && err.name === 'AbortError';
      const appError = isCanceled ? null : this.asExportError(err);
      // Write `error` before flipping the export state so subscribers
      // that react to the run-ending edge see the report already in
      // place when they snapshot the editor.
      this.editorStore.patch({ error: appError });
      this.exportStore.finish(null);
      if (appError) {
        const cause = appError.cause instanceof Error ? appError.cause : null;
        this.telemetry.capture('export_failed', {
          format: options.format,
          resolution: this.describeResolution(options.resolution),
          elapsed_ms: Math.round(performance.now() - startedAt),
          error_name: appError.name,
          error_message: appError.message,
          error_cause_name: cause ? cause.name : null,
          error_cause_message: cause ? cause.message : null,
        });
      }
    } finally {
      console.timeEnd('[export] total');
      writer.dispose();
    }
  }

  private describeResolution(resolution: ExportResolution): string {
    if (resolution === 'original') return 'original';
    return `${resolution.width}x${resolution.height}`;
  }

  /**
   * Emits one telemetry event per sheet describing how the user has
   * customized the template that sheet uses. Fires at the start of an
   * export so the snapshot reflects what is actually being rendered,
   * not intermediate state the user explored and reverted.
   */
  private captureTemplateUsageAtExport(sheets: readonly Sheet[]): void {
    for (const sheet of sheets) {
      const customized = this.customizationDiff.diff(sheet);
      this.telemetry.capture('template_used_at_export', {
        template_id: sheet.template.metadata.id,
        template_categories: [...sheet.template.metadata.categories],
        customized_properties: [...customized],
        customized_count: customized.length,
      });
    }
  }

  private updateProgress(percent: number): void {
    this.progressStore.setPercent(percent);
  }

  /**
   * Resolves the original-video bytes a render needs. When the editor
   * already has them, returns immediately. When the project's original
   * is still streaming in, waits for the download to finish and
   * advances the active export into the rendering phase before
   * returning the freshly published file.
   *
   * Rejects when the download settles in a failed state — the caller's
   * surrounding try/catch turns that into the standard export-failure
   * surfacing.
   */
  private async resolveOriginalVideoFile(initial: File | null): Promise<File> {
    if (initial !== null) return initial;
    await this.downloadStore.waitUntilReady();
    this.exportStore.enterRenderingPhase();
    const file = this.editorStore.snapshot().video.file;
    if (file === null) {
      throw new ExportFailedError({ cause: new Error('Original video bytes are still missing after the download reported ready') });
    }
    return file;
  }

  private async persistBeforeRender(): Promise<void> {
    try {
      await this.saveProject.execute();
    } catch (cause) {
      // Best-effort: a save failure here must not block an export the
      // user already committed to. The error surfaces in the editor
      // store so the next render-tick reflects it.
      console.error('[export] auto-save before render failed', cause);
      this.editorStore.patch({ error: new ProjectSaveFailedError({ cause }) });
    }
  }

  private asExportError(err: unknown): AppError {
    return err instanceof AppError ? err : new ExportFailedError({ cause: err });
  }

  /**
   * Builds and opens the writer for this export. Returns `null` when the
   * writer rejects with `AbortError` (the user dismissed an interactive
   * prompt) so the caller can abort without spending any encoding time.
   */
  private async openWriter(format: OutputFormat): Promise<ExportWriter | null> {
    const writer = this.exportWriterFactory.create();
    try {
      await writer.open(format);
      return writer;
    } catch (err) {
      writer.dispose();
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  private triggerDownload(blob: Blob, format: OutputFormat): void {
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `subtitled.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Groups per-word and per-decoration overrides by the sheet id of
   * the section each element belongs to. The renderer dispatches per
   * frame using `Section.kind` as the lookup key, so each bucket maps
   * to one `SubtitleStyle.wordOverrides`.
   */
  private collectWordOverrides(
    doc: Document,
    overrides: WordStyleOverrideRegistry,
  ): Record<string, ElementRenderOverrides> {
    const buckets: Record<string, Array<readonly [string, ScopedRenderOverride]>> = {};
    for (const section of doc.sections) {
      const sheetId = section.kind;
      for (const segment of section.segments) {
        for (const line of segment.lines) {
          for (const word of line.words) {
            const wordEntry = this.buildOverrideEntry(word.id, overrides);
            if (wordEntry) {
              const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
              bucket.push([word.id, wordEntry]);
            }
            if (word.decoration) {
              const decorationEntry = this.buildOverrideEntry(word.decoration.id, overrides);
              if (decorationEntry) {
                const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
                bucket.push([word.decoration.id, decorationEntry]);
              }
            }
          }
        }
      }
    }
    const result: Record<string, ElementRenderOverrides> = {};
    for (const [sheetId, entries] of Object.entries(buckets)) {
      result[sheetId] = ElementRenderOverrides.fromEntries(entries);
    }
    return result;
  }

  /**
   * Groups the sheet's default decoration placements by the host
   * sheet id, flattened across every segment in the section so the
   * renderer can look up by decoration id alone.
   */
  private collectDecorationPlacements(
    doc: Document,
    sheets: ReadonlyArray<Sheet>,
  ): Record<string, Map<string, DecorationPlacementSide>> {
    const sheetsById = new Map<string, Sheet>(sheets.map((s) => [s.id, s]));
    const result: Record<string, Map<string, DecorationPlacementSide>> = {};
    for (const section of doc.sections) {
      const sheet = sheetsById.get(section.kind);
      if (!sheet) continue;
      for (const segment of section.segments) {
        const perSegment = this.decorationPlacementResolver.buildSegmentPlacements(sheet, segment);
        if (perSegment.size === 0) continue;
        const bucket = result[sheet.id] ?? (result[sheet.id] = new Map<string, DecorationPlacementSide>());
        for (const [decorationId, side] of perSegment) bucket.set(decorationId, side);
      }
    }
    return result;
  }

  private buildOverrideEntry(
    elementId: string,
    overrides: WordStyleOverrideRegistry,
  ): ScopedRenderOverride | null {
    const alignment = overrides.buildAlignmentOverride(elementId);
    const inlineStyles = overrides.buildInlineStyles(elementId);
    const scoped: ScopedRenderOverride = {
      ...(Object.keys(inlineStyles).length > 0 ? { inlineStyles } : {}),
      ...(alignment ? { alignment } : {}),
    };
    if (!scoped.inlineStyles && !scoped.alignment) return null;
    return scoped;
  }

  /**
   * Builds the per-segment overrides for a sheet by walking the
   * document's segments in document order, asking the rotation resolver
   * for each and merging the user's per-segment overrides. Segments
   * with no inline-style and no alignment override are omitted so the
   * renderer falls back to the sheet's root defaults.
   */
  private async loadPersonSegmentationResult(projectId: string | null): Promise<PersonSegmentationResult | null> {
    if (projectId === null) return null;
    try {
      return await this.personSegmentationCache.load(projectId);
    } catch (error) {
      console.error('[export] failed to load person-segmentation cache', error);
      return null;
    }
  }

  /**
   * Fills mask gaps for every force-on segment before the render
   * starts — a forced segment outside the detector's windows has no
   * masks from the initial scan (or lost them to a re-scan on another
   * device). Best-effort per segment: a failed backfill logs and the
   * export proceeds with whatever the cache holds. Returns whether any
   * backfill ran, so the caller knows to reload the cached result.
   */
  private async backfillForcedSegmentMasks(doc: Document, segmentOverrides: SegmentOverrides): Promise<boolean> {
    let anyRan = false;
    for (const section of doc.sections) {
      for (const segment of section.segments) {
        if (segmentOverrides.behindActorOverrideFor(segment.id) !== 'force-on') continue;
        try {
          await this.ensureSegmentMasks.execute({
            segmentId: segment.id,
            range: { start: segment.time.start, end: segment.time.end },
          });
          anyRan = true;
        } catch (error) {
          console.error('[export] failed to backfill masks for forced segment', segment.id, error);
        }
      }
    }
    return anyRan;
  }

  private collectSegmentOverrides(
    doc: Document,
    sheet: Sheet,
    segmentOverrides: SegmentOverrides,
    behindActorVars: ReadonlyMap<string, InlineStyleMap>,
  ): ElementRenderOverrides {
    const entries: Array<readonly [string, ScopedRenderOverride]> = [];
    let segIdx = 0;
    for (const section of doc.sections) {
      if (section.kind !== sheet.id) continue;
      for (const segment of section.segments) {
        const colorOverrides = this.segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx);
        const userInlineStyles = segmentOverrides.buildInlineStyles(segment.id);
        const behindActorInlineStyles = behindActorVars.get(segment.id) ?? {};
        const inlineStyles = { ...colorOverrides, ...userInlineStyles, ...behindActorInlineStyles };
        const alignment = segmentOverrides.buildAlignmentOverride(segment.id);
        const scoped: ScopedRenderOverride = {
          ...(Object.keys(inlineStyles).length > 0 ? { inlineStyles } : {}),
          ...(alignment ? { alignment } : {}),
        };
        if (scoped.inlineStyles || scoped.alignment) entries.push([segment.id, scoped]);
        segIdx++;
      }
    }
    return ElementRenderOverrides.fromEntries(entries);
  }

}
