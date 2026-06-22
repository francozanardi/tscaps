import type { Document, DecorationPlacementSide, VideoRenderer, SubtitleStyle, OutputFormat, RenderQuality, ScopedRenderOverride, AudioDiscardReason } from '@tscaps/engine';
import { ElementRenderOverrides, SvgFilterBundle } from '@tscaps/engine';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';
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
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
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
    private readonly renderer: VideoRenderer,
    private readonly sheetCssVarsBuilder: SheetCssVarsBuilder,
    private readonly segmentColorRotation: SegmentColorRotation,
    private readonly fontFaceCssBuilder: FontFaceCssBuilder,
    private readonly sheetFontFamilyCollector: SheetFontFamilyCollector,
    private readonly documentUsedCodepointCollector: DocumentUsedCodepointCollector,
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
    private readonly decorationPlacementResolver: DecorationPlacementResolver,
    private readonly decorationFilter: DecorationFilter,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly telemetry: Telemetry,
    private readonly customizationDiff: SheetCustomizationDiff,
    private readonly overlayHtmlProvider?: ExportOverlayHtmlProvider,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const { video, document: subtitleDoc, sheets, projectId, wordStyleOverrides, segmentOverrides, decorationOverrides } = this.editorStore.snapshot();
    const videoFile = video.file;
    const videoLayout = video.layout;
    if (!videoFile || !subtitleDoc || sheets.length === 0) return;

    const renderDoc = this.decorationFilter.filterDocument(subtitleDoc, sheets, decorationOverrides);
    const wordOverridesBySheet = this.collectWordOverrides(renderDoc, wordStyleOverrides);
    const decorationPlacementsBySheet = this.collectDecorationPlacements(renderDoc, sheets);
    const usedCodepoints = this.documentUsedCodepointCollector.collect(renderDoc);

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
      styles[sheet.id] = {
        css: fontFaces ? `${fontFaces}\n${sheetCss}` : sheetCss,
        inlineStyles,
        alignment: sheet.alignmentConfig,
        rendering: {
          splitWordsIntoLetters: webRendering.splitWordsIntoLetters,
          videoFrame: {
            required: webRendering.videoFrame.required,
            jpegQuality: webRendering.videoFrame.jpegQuality,
          },
          padding: webRendering.padding,
        },
        wordOverrides: wordOverridesBySheet[sheet.id] ?? ElementRenderOverrides.empty(),
        segmentOverrides: this.collectSegmentOverrides(subtitleDoc, sheet, segmentOverrides),
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
    this.exportStore.start();
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
      await this.renderer.render(
        {
          video: videoFile,
          document: renderDoc,
          styles,
          ...(overlayHtml ? { overlayHtml } : {}),
          outputFormat: options.format,
          quality: options.quality,
          ...(options.resolution !== 'original' ? { outputResolution: options.resolution } : {}),
          outputStream: writer.stream(),
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
  private collectSegmentOverrides(
    doc: Document,
    sheet: Sheet,
    segmentOverrides: SegmentOverrides,
  ): ElementRenderOverrides {
    const entries: Array<readonly [string, ScopedRenderOverride]> = [];
    let segIdx = 0;
    for (const section of doc.sections) {
      if (section.kind !== sheet.id) continue;
      for (const segment of section.segments) {
        const colorOverrides = this.segmentColorRotation.resolveOverrides(sheet, segment.id, segIdx);
        const userInlineStyles = segmentOverrides.buildInlineStyles(segment.id);
        const inlineStyles = { ...colorOverrides, ...userInlineStyles };
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
