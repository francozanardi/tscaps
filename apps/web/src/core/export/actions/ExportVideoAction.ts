import type { Document, VideoRenderer, SubtitleStyle, OutputFormat, RenderQuality, ScopedRenderOverride, AudioDiscardReason } from '@tscaps/engine';
import { ElementRenderOverrides, SvgFilterBundle } from '@tscaps/engine';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { FontFaceCssBuilder } from '@core/templates/services/FontFaceCssBuilder';
import { TemplateCssVariable } from '@core/templates/domain/TemplateCssVariable';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import type { ExportWriter } from '@core/editor/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/editor/domain/ExportWriterFactory';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';

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
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly telemetry: Telemetry,
    private readonly customizationDiff: SheetCustomizationDiff,
    private readonly overlayHtmlProvider?: ExportOverlayHtmlProvider,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const { video, document: subtitleDoc, sheets, projectId, wordStyleOverrides, segmentOverrides } = this.editorStore.snapshot();
    const videoFile = video.file;
    const videoLayout = video.layout;
    if (!videoFile || !subtitleDoc || sheets.length === 0) return;

    const wordOverridesBySheet = this.collectWordOverrides(subtitleDoc, wordStyleOverrides);
    const usedCodepoints = this.collectUsedCodepoints(subtitleDoc);

    const styles: Record<string, SubtitleStyle> = {};
    for (const sheet of sheets) {
      const inlineStyles = this.sheetCssVarsBuilder.build(sheet);
      const families = new Set<string>();
      const ff = inlineStyles[TemplateCssVariable.FONT_FAMILY];
      if (ff) families.add(this.unquote(ff));
      this.collectOverrideFontFamilies(subtitleDoc, sheet.id, wordStyleOverrides, segmentOverrides, families);
      const fontFaces = this.fontFaceCssBuilder.build(families, usedCodepoints);
      const sheetCss = sheet.resolveCss();
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
          document: subtitleDoc,
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
      // Write `error` before flipping the export state so subscribers
      // that react to the run-ending edge see the message already in
      // place when they snapshot the editor.
      this.editorStore.patch({
        error: isCanceled ? null : (err instanceof Error ? err.message : 'Export failed'),
      });
      this.exportStore.finish(null);
      if (!isCanceled) {
        this.telemetry.capture('export_failed', {
          format: options.format,
          resolution: this.describeResolution(options.resolution),
          elapsed_ms: Math.round(performance.now() - startedAt),
          error_message: err instanceof Error ? err.message : 'unknown',
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
    } catch (err) {
      // Best-effort: a save failure here must not block an export the
      // user already committed to. The error surfaces in the editor
      // store so the next render-tick reflects it.
      console.error('[export] auto-save before render failed', err);
      this.editorStore.patch({
        error: err instanceof Error ? err.message : 'Failed to save project before export',
      });
    }
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
   * Groups per-word overrides by the sheet id of the section each word
   * belongs to. The renderer dispatches per-frame using `Section.kind`
   * as the lookup key, so the override map has to be sliced the same way.
   * Each entry carries the word's inline-style and alignment overrides
   * separately so the engine can apply them to their respective targets
   * (the word's span vs. its anchor).
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
            if (!overrides.hasAnyFor(word.id)) continue;
            const inlineStyles = overrides.buildInlineStyles(word.id);
            const alignment = overrides.buildAlignmentOverride(word.id);
            const scoped: ScopedRenderOverride = {
              ...(Object.keys(inlineStyles).length > 0 ? { inlineStyles } : {}),
              ...(alignment ? { alignment } : {}),
            };
            if (!scoped.inlineStyles && !scoped.alignment) continue;
            const bucket = buckets[sheetId] ?? (buckets[sheetId] = []);
            bucket.push([word.id, scoped]);
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
    for (const segment of doc.getSegments()) {
      if (segment.getSection().kind !== sheet.id) continue;
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
    return ElementRenderOverrides.fromEntries(entries);
  }

  /**
   * Walks every word in the document and returns the set of Unicode
   * codepoints that the rendered captions will exercise. Used to trim
   * `@font-face` declarations subsetted by `unicode-range` down to the
   * subsets the text actually needs. The uppercase/lowercase variants are
   * also included so `text-transform: uppercase|lowercase` keeps working.
   */
  private collectUsedCodepoints(doc: Document): Set<number> {
    const out = new Set<number>();
    for (const section of doc.sections) {
      for (const segment of section.segments) {
        for (const line of segment.lines) {
          for (const word of line.words) {
            this.addCodepoints(word.displayText, out);
            this.addCodepoints(word.displayText.toUpperCase(), out);
            this.addCodepoints(word.displayText.toLowerCase(), out);
          }
        }
      }
    }
    return out;
  }

  private addCodepoints(text: string, out: Set<number>): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) out.add(cp);
    }
  }

  /**
   * Adds to `out` every font family introduced by word- or segment-level
   * overrides on segments owned by `sheetId`. The export SVG runs in an
   * isolated CSS context, so any family the user picked via overrides must
   * also feed into `fontFaceCssReader.read` — otherwise its `@font-face`
   * isn't inlined and the renderer falls back to the system default.
   */
  private collectOverrideFontFamilies(
    doc: Document,
    sheetId: string,
    wordOverrides: WordStyleOverrideRegistry,
    segmentOverrides: SegmentOverrides,
    out: Set<string>,
  ): void {
    for (const section of doc.sections) {
      if (section.kind !== sheetId) continue;
      for (const segment of section.segments) {
        const segFf = segmentOverrides.getStyle(segment.id).fontFamily;
        if (segFf) out.add(segFf);
        for (const line of segment.lines) {
          for (const word of line.words) {
            const wordFf = wordOverrides.get(word.id).fontFamily;
            if (wordFf) out.add(wordFf);
          }
        }
      }
    }
  }

  /**
   * Strips wrapping single/double quotes from a CSS value. The sheet's
   * `inlineStyles` carry font-family values quoted (`'Press Start 2P'`)
   * because digit-leading idents are otherwise invalid CSS — we need
   * the bare name to match against the @font-face declarations.
   */
  private unquote(v: string): string {
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      return v.slice(1, -1);
    }
    return v;
  }
}
