import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Document,
  Line,
  Section,
  Segment,
  TimeFragment,
  Word,
  type AlignmentConfig,
  type RenderJob,
  type RenderProgress,
  type RenderResult,
  type SvgFilterDefinitions,
  type VideoRenderer,
} from '@tscaps/engine';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import { ExportRunTelemetry } from '@core/export/services/ExportRunTelemetry';
import { ExportStore } from '@core/export/store/ExportStore';
import { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import { UnrestrictedExportAccessPolicy } from '@core/export/services/UnrestrictedExportAccessPolicy';
import type { ExportAccessPolicy } from '@core/export/domain/ExportAccessPolicy';
import { ExportVideoAction, type ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import { ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { OriginalVideoResolution, OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { VisibilityTracker } from '@core/_shared/domain/VisibilityTracker';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import type { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import type { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';

/**
 * What the export hands the renderer, and what it does with the result.
 *
 * The oracle throughout is the `RenderJob` the renderer receives: it is
 * the complete description of the file about to be burned, so a change
 * that alters the output has to alter it. Written to survive the action
 * being split apart — nothing here names a collaborator or an internal
 * step, only the job that comes out and the state that is left behind.
 */

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

function buildTemplate(id: string): Template {
  return new Template(
    { id, category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    { splitWordsIntoLetters: false, videoFrame: { required: false, jpegQuality: 0.8 }, padding: {} } as unknown as RenderingConfig,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    [],
    [],
    { mode: 'none' } as unknown as LineSplitterConfig,
    [],
    [],
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
}

function buildSheet(id: string): Sheet {
  return new Sheet({
    id,
    name: id,
    color: '#ffffff',
    template: buildTemplate(`${id}-template`),
    variantIndex: 0,
    styleValues: StyleValues.fromTemplate([]),
    typographyConfig: TYPOGRAPHY_DEFAULTS,
    rotationConfig: ROTATION_DEFAULTS,
    segmentSplitterConfigs: [],
    lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
    alignmentConfig: ALIGNMENT,
    effectConfigs: [],
  });
}

interface WordSpec {
  readonly id: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

function buildDocument(sheetId: string, words: readonly WordSpec[]): Document {
  return new Document({
    sections: [
      new Section({
        kind: sheetId,
        id: `${sheetId}-section`,
        segments: [
          new Segment({
            id: `${sheetId}-segment`,
            lines: [
              new Line({
                id: `${sheetId}-line`,
                words: words.map((word) => new Word({
                  id: word.id,
                  text: word.text,
                  time: new TimeFragment(word.start, word.end),
                })),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

class RecordingRenderer implements VideoRenderer {
  lastJob: RenderJob | null = null;
  failWith: Error | null = null;

  async render(job: RenderJob, onProgress?: (progress: RenderProgress) => void): Promise<RenderResult> {
    this.lastJob = job;
    onProgress?.({ percent: 50, currentFrame: 1, totalFrames: 2 });
    if (this.failWith) throw this.failWith;
    return { blob: null, mimeType: 'video/mp4' };
  }
}

class RecordingWriter implements ExportWriter {
  opened = false;
  aborted = false;
  finalized = false;

  async open(): Promise<void> { this.opened = true; }
  stream(): WritableStream<never> { return new WritableStream<never>(); }
  async finalize(): Promise<File | null> { this.finalized = true; return new File(['out'], 'subtitled.mp4'); }
  async abort(): Promise<void> { this.aborted = true; }
  dispose(): void { /* nothing retained */ }
}

class RecordingTelemetry implements Telemetry {
  readonly events: Array<{ name: TelemetryEventName; properties: TelemetryEventProperties }> = [];

  capture(name: TelemetryEventName, properties: TelemetryEventProperties = {}): void {
    this.events.push({ name, properties });
  }

  names(): TelemetryEventName[] {
    return this.events.map((event) => event.name);
  }

  propertiesOf(name: TelemetryEventName): TelemetryEventProperties {
    return this.events.find((event) => event.name === name)?.properties ?? {};
  }
}

/** Answers from the editor store, with both outcomes under the test's control. */
class FakeOriginalVideoResolver {
  fileInEditorReads = true;
  storage: OriginalVideoResolution = { outcome: 'missing', reason: 'absent' };

  constructor(private readonly store: EditorStore) {}

  async readableFileInEditor(): Promise<File | null> {
    const file = this.store.snapshot().video.file;
    if (file === null || !this.fileInEditorReads) return null;
    return file;
  }

  async readableFileFromStorage(): Promise<OriginalVideoResolution> {
    return this.storage;
  }
}

const DEFAULT_OPTIONS: ExportVideoOptions = {
  format: 'mp4',
  quality: 'high',
  resolution: 'original',
};

interface Harness {
  readonly action: ExportVideoAction;
  readonly store: EditorStore;
  readonly renderer: RecordingRenderer;
  readonly writer: RecordingWriter;
  readonly telemetry: RecordingTelemetry;
  readonly exportStore: ExportStore;
  readonly downloaded: Blob[];
  readonly originalVideoResolver: FakeOriginalVideoResolver;
}

function buildHarness(
  contributors: ReadonlyArray<ExportRenderContributor> = [],
  accessPolicy: ExportAccessPolicy = new UnrestrictedExportAccessPolicy(),
): Harness {
  const store = new EditorStore();
  const exportStore = new ExportStore();
  const renderer = new RecordingRenderer();
  const writer = new RecordingWriter();
  const telemetry = new RecordingTelemetry();
  const downloaded: Blob[] = [];
  const originalVideoResolver = new FakeOriginalVideoResolver(store);

  // The css / font collaborators answer with fixed strings: what they
  // produce is their own promise and is covered where they live, and
  // pinning it here would make this test fail on every wording change
  // inside them.
  const cssVarsBuilder = { build: () => ({ '--x': '1' }) } as unknown as SheetCssVarsBuilder;
  const layeredCssBuilder = { build: () => '.caption{}' } as unknown as LayeredCaptionCssBuilder;
  const fontOverridesBuilder = { build: () => ({ subtreeBySheet: {}, segmentsBySheet: {} }) } as unknown as CaptionFontOverridesBuilder;
  const fontFacesBuilder = { build: () => '' } as unknown as SheetFontFacesBuilder;
  const svgFilterResolver = { resolve: () => ({}) } as unknown as SheetSvgFilterDefinitionsResolver;
  const decorationFilter = { filterDocument: (doc: Document) => doc } as unknown as DecorationFilter;

  const planner = new ExportRenderPlanner(
    new CutAwareDocumentBuilder(),
    decorationFilter,
    new SubtitleStyleSetBuilder(
      cssVarsBuilder,
      layeredCssBuilder,
      fontOverridesBuilder,
      new SegmentColorRotation(),
      fontFacesBuilder,
      new DocumentUsedCodepointCollector(),
      svgFilterResolver,
      new DecorationPlacementResolver(),
    ),
    contributors,
  );

  const action = new ExportVideoAction(
    store,
    exportStore,
    originalVideoResolver as unknown as OriginalVideoResolver,
    renderer,
    planner,
    new ExportPauseCoordinator(exportStore),
    { create: () => writer } as unknown as ExportWriterFactory,
    { download: (blob: Blob) => { downloaded.push(blob); } } as unknown as FileDownloader,
    new ExportProgressStore(),
    { execute: async () => undefined } as unknown as SaveProjectAction,
    new ExportRunTelemetry(
      telemetry,
      store,
      new SheetCustomizationDiff(),
      { describe: () => ({ error_name: 'x' }) } as unknown as AppErrorTelemetryDescriber,
    ),
    { report: () => undefined } as unknown as NonBlockingFailureReporter,
    { begin: () => ({ wasHidden: false, currentState: 'visible', end: () => undefined }) } as unknown as VisibilityTracker,
    accessPolicy,
    false,
  );

  return { action, store, renderer, writer, telemetry, exportStore, downloaded, originalVideoResolver };
}

function loadProject(store: EditorStore, sheets: readonly Sheet[], document: Document): void {
  store.patch({ document, sheets: [...sheets] });
  store.patchVideo({
    file: new File(['bytes'], 'clip.mp4', { type: 'video/mp4' }),
    fileName: 'clip.mp4',
    layout: { width: 1080, height: 1920 },
    duration: 10,
  });
}

describe('ExportVideoAction', () => {

  let harness: Harness;

  beforeEach(() => {
    vi.spyOn(console, 'time').mockImplementation(() => undefined);
    vi.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
    harness = buildHarness();
  });

  describe('what reaches the renderer', () => {

    it('hands over the loaded video and one style per sheet, keyed by sheet id', async () => {
      const sheets = [buildSheet('main'), buildSheet('hook')];
      loadProject(harness.store, sheets, buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);

      const job = harness.renderer.lastJob;
      expect(job?.video.name).toBe('clip.mp4');
      expect(Object.keys(job?.styles ?? {}).sort()).toEqual(['hook', 'main']);
    });

    it('keeps the source resolution out of the job, and passes an explicit one through', async () => {
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);
      expect(harness.renderer.lastJob?.outputResolution).toBeUndefined();

      await harness.action.execute({ ...DEFAULT_OPTIONS, resolution: { width: 540, height: 960 } });
      expect(harness.renderer.lastJob?.outputResolution).toEqual({ width: 540, height: 960 });
    });

    it('sends the cut ranges only when there are cuts', async () => {
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
        { id: 'w2', text: 'world', start: 5, end: 6 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);
      expect(harness.renderer.lastJob?.skipRanges).toBeUndefined();

      harness.store.patch({ cuts: CutRegistry.fromSnapshot([{ startSec: 2, endSec: 4 }]) });
      await harness.action.execute(DEFAULT_OPTIONS);
      expect(harness.renderer.lastJob?.skipRanges).toEqual([{ startSec: 2, endSec: 4 }]);
    });

    it('routes a word placement into the style of the sheet its section belongs to', async () => {
      const sheets = [buildSheet('main'), buildSheet('hook')];
      loadProject(harness.store, sheets, buildDocument('hook', [
        { id: 'placed', text: 'hello', start: 0, end: 1 },
      ]));
      harness.store.patch({
        elementStyles: ElementStyles.empty().withPlacement('placed', 'word', {
          verticalAlign: 'top', verticalOffset: 0.25, horizontalAlign: 'left', horizontalOffset: 0.5,
        }),
      });

      await harness.action.execute(DEFAULT_OPTIONS);

      const job = harness.renderer.lastJob;
      expect(job?.styles['hook']?.subtreeOverrides?.get('placed')?.alignment?.verticalOffset).toBe(0.25);
      expect(job?.styles['main']?.subtreeOverrides?.get('placed')).toBeUndefined();
    });

    it('carries the segment classes and top layer a contributor supplies', async () => {
      const topLayer = { paint: () => undefined } as never;
      const contributor: ExportRenderContributor = {
        prepare: async () => ({
          segmentClasses: new Map([['main-segment', ['behind-actor']]]),
          topLayer,
        }),
      };
      harness = buildHarness([contributor]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);

      const job = harness.renderer.lastJob;
      expect(job?.topLayer).toBe(topLayer);
      expect(job?.styles['main']?.segmentOverrides?.get('main-segment')?.classes).toEqual(['behind-actor']);
    });
  });

  describe('what it refuses to start', () => {

    it('renders nothing when the active project output is plan-gated', async () => {
      harness = buildHarness([], {
        access: () => ({
          available: false,
          reason: { kind: 'outside-plan', feature: 'translations' },
        }),
      });
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hola', start: 0, end: 1 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob).toBeNull();
      expect(harness.writer.opened).toBe(false);
    });

    it.each([
      ['no document', (store: EditorStore) => store.patch({ document: null })],
      ['no sheets', (store: EditorStore) => store.patch({ sheets: [] })],
      ['no loaded original', (store: EditorStore) => store.patchVideo({ fileName: null })],
    ])('renders nothing with %s', async (_label, breakIt) => {
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));
      breakIt(harness.store);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob).toBeNull();
      expect(harness.writer.opened).toBe(false);
    });
  });

  describe('what it leaves behind', () => {

    beforeEach(() => {
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));
    });

    it('finalizes the writer and downloads the file it produced', async () => {
      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.writer.finalized).toBe(true);
      expect(harness.writer.aborted).toBe(false);
      expect(harness.downloaded).toHaveLength(1);
      expect(harness.telemetry.names()).toContain('export_completed');
    });

    it('aborts the writer and reports the failure when the render throws', async () => {
      harness.renderer.failWith = new Error('encoder died');

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.writer.aborted).toBe(true);
      expect(harness.downloaded).toHaveLength(0);
      expect(harness.telemetry.names()).toContain('export_failed');
      expect(harness.store.snapshot().error).not.toBeNull();
    });

    it('renders the stored copy when the file the editor holds no longer reads', async () => {
      const stored = new File(['stored bytes'], 'clip.mp4', { type: 'video/mp4' });
      harness.originalVideoResolver.fileInEditorReads = false;
      harness.originalVideoResolver.storage = { outcome: 'found', file: stored, source: 'device' };

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.video).toBe(stored);
      expect(harness.downloaded).toHaveLength(1);
      expect(harness.telemetry.propertiesOf('export_completed')['video_source']).toBe('device');
    });

    it('waits on the original instead of claiming to render, when the held file will not read', async () => {
      harness.originalVideoResolver.fileInEditorReads = false;
      harness.originalVideoResolver.storage = {
        outcome: 'found',
        file: new File(['stored bytes'], 'clip.mp4', { type: 'video/mp4' }),
        source: 'device',
      };
      const phases: string[] = [];
      harness.exportStore.addEventListener('change', () => {
        const phase = harness.exportStore.run?.phase;
        if (phase) phases.push(phase);
      });

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(phases[0]).toBe('awaiting-original');
    });

    it('asks for the video back when no copy anywhere can produce bytes', async () => {
      harness.originalVideoResolver.fileInEditorReads = false;
      harness.originalVideoResolver.storage = { outcome: 'missing', reason: 'held-file-gone' };

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.store.snapshot().error?.name).toBe('OriginalVideoUnavailableError');
      expect(harness.telemetry.propertiesOf('original_video_unavailable')['reason']).toBe('held-file-gone');
      expect(harness.renderer.lastJob).toBeNull();
      expect(harness.writer.aborted).toBe(true);
    });

    it('records which copy the render was reading when it failed', async () => {
      harness.renderer.failWith = new Error('encoder died');

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.telemetry.propertiesOf('export_failed')['video_source']).toBe('memory');
    });

    it('counts a dismissed save prompt as a cancellation, not a failure', async () => {
      harness.renderer.failWith = Object.assign(new Error('gone'), { name: 'AbortError' });

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.telemetry.names()).toContain('export_cancelled');
      expect(harness.telemetry.names()).not.toContain('export_failed');
      expect(harness.store.snapshot().error).toBeNull();
    });

    it('reports how far the failed run had got', async () => {
      harness.renderer.failWith = new Error('encoder died');

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.telemetry.propertiesOf('export_failed')['progress_percent']).toBe(50);
    });
  });
});
