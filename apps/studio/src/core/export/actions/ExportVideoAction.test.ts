import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { AudioMixExportContributor } from '@core/audio-mix/services/AudioMixExportContributor';
import { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import { FootageSoundReader } from '@core/audio-mix/services/FootageSoundReader';
import { RenderAudioMixBuilder } from '@core/audio-mix/services/RenderAudioMixBuilder';
import { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import {
  CaptionBlendMode,
  CaptionStacking,
  Document,
  Line,
  Section,
  Segment,
  TimeFragment,
  Word,
  type AlignmentConfig,
  type AudioMixDropReason,
  type FootageLayer,
  type RenderFootage,
  type RenderJob,
  type RenderProgress,
  type RenderResult,
  type SvgFilterDefinitions,
  type VideoRenderer,
  type VideoEncoderSelection,
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
import { VideoCompositionTelemetryDescriber } from '@core/export/services/VideoCompositionTelemetryDescriber';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import { ExportStore } from '@core/export/store/ExportStore';
import { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import { ExportCancelCoordinator } from '@core/export/services/ExportCancelCoordinator';
import { CancelExportAction } from '@core/export/actions/CancelExportAction';
import { UnrestrictedExportAccessPolicy } from '@core/export/services/UnrestrictedExportAccessPolicy';
import type { ExportAccessPolicy } from '@core/export/domain/ExportAccessPolicy';
import { ExportVideoAction, type ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import { ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import { ExportRenderPlanRequestBuilder } from '@core/export/services/ExportRenderPlanRequestBuilder';
import { ExportRenderJobBuilder } from '@core/export/services/ExportRenderJobBuilder';
import { ElementBlendResolver } from '@core/elements/services/ElementBlendResolver';
import { SegmentSubtreeOverridesBuilder } from '@core/captions/services/SegmentSubtreeOverridesBuilder';
import { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportRenderContribution, ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
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
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';

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

function buildSheet(id: string, styleValues: StyleValues = StyleValues.fromTemplate([])): Sheet {
  return new Sheet({
    id,
    name: id,
    color: '#ffffff',
    template: buildTemplate(`${id}-template`),
    variantIndex: 0,
    styleValues,
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

interface CaptionSpec {
  readonly id: string;
  readonly words: readonly WordSpec[];
}

/** One segment per caption, each a single line, all in one section. */
function buildCaptionsDocument(sheetId: string, captions: readonly CaptionSpec[]): Document {
  return new Document({
    sections: [
      new Section({
        kind: sheetId,
        id: `${sheetId}-section`,
        segments: captions.map((caption) => new Segment({
          id: caption.id,
          lines: [
            new Line({
              id: `${caption.id}-line`,
              words: caption.words.map((word) => new Word({
                id: word.id,
                text: word.text,
                time: new TimeFragment(word.start, word.end),
              })),
            }),
          ],
        })),
      }),
    ],
  });
}

class RecordingRenderer implements VideoRenderer {
  lastJob: RenderJob | null = null;
  failWith: Error | null = null;
  /** Leaves the soundtrack out for this reason, the way a browser that cannot mix it would. */
  dropsAudioMixWith: AudioMixDropReason | null = null;
  /** The WebCodecs error the render reports falling back from on the video's own sound, if any. */
  fallsBackOnInputAudioFrom: Error | null = null;
  /** Announced to the job before the render goes any further, as the engine does once it has chosen. */
  encoderSelection: VideoEncoderSelection | null = null;
  /** Keeps the render going until its signal fires, the way a long one would. */
  runsUntilAborted = false;
  /** Layers of the mix whose source cannot be decoded, which the render asks about before going on, as the engine does. */
  undecodableAudioLayerIds: string[] = [];
  /** What the job answered when asked to go on without them; null when it was not asked. */
  wentOnWithoutUndecodable: boolean | null = null;
  private startedResolve: (() => void) | null = null;
  readonly started = new Promise<void>((resolve) => { this.startedResolve = resolve; });

  async render(job: RenderJob, onProgress?: (progress: RenderProgress) => void): Promise<RenderResult> {
    this.lastJob = job;
    if (this.encoderSelection) job.onVideoEncoderSelected?.(this.encoderSelection);
    onProgress?.({ percent: 50, currentFrame: 1, totalFrames: 2 });
    this.startedResolve?.();
    if (this.fallsBackOnInputAudioFrom !== null && job.audioMix) job.onAudioMixInputFallback?.(this.fallsBackOnInputAudioFrom);
    if (this.dropsAudioMixWith !== null && job.audioMix) job.onAudioMixDropped?.(this.dropsAudioMixWith);
    if (this.undecodableAudioLayerIds.length > 0 && job.audioMix) {
      this.wentOnWithoutUndecodable = await job.confirmUndecodableAudioLayers?.(this.undecodableAudioLayerIds) ?? false;
      if (!this.wentOnWithoutUndecodable) throw new DOMException('Declined without the sounds.', 'AbortError');
    }
    if (this.failWith) throw this.failWith;
    if (this.runsUntilAborted) await this.untilAborted(job.signal);
    return { blob: null, mimeType: 'video/mp4' };
  }

  private untilAborted(signal: AbortSignal | undefined): Promise<never> {
    return new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new DOMException('The transcode was aborted.', 'AbortError'));
      });
    });
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
  readonly cancel: CancelExportAction;
  readonly store: EditorStore;
  readonly renderer: RecordingRenderer;
  readonly writer: RecordingWriter;
  readonly telemetry: RecordingTelemetry;
  readonly exportStore: ExportStore;
  readonly downloaded: Blob[];
  readonly originalVideoResolver: FakeOriginalVideoResolver;
  readonly pause: ExportPauseCoordinator;
  readonly mediaAssets: MediaAssetStore;
}

function buildHarness(
  contributors: ReadonlyArray<ExportRenderContributor> = [],
  accessPolicy: ExportAccessPolicy = new UnrestrictedExportAccessPolicy(),
  mixCodec: string | null = 'aac',
): Harness {
  const store = new EditorStore();
  const exportStore = new ExportStore();
  const renderer = new RecordingRenderer();
  const writer = new RecordingWriter();
  const telemetry = new RecordingTelemetry();
  const downloaded: Blob[] = [];
  const originalVideoResolver = new FakeOriginalVideoResolver(store);
  const pause = new ExportPauseCoordinator(exportStore);
  const cancelCoordinator = new ExportCancelCoordinator();
  const mediaAssets = new MediaAssetStore();

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
      new SegmentSubtreeOverridesBuilder(new ElementBlendResolver()),
    ),
    contributors,
  );

  const action = new ExportVideoAction(
    store,
    exportStore,
    originalVideoResolver as unknown as OriginalVideoResolver,
    renderer,
    planner,
    pause,
    cancelCoordinator,
    { create: () => writer } as unknown as ExportWriterFactory,
    { download: (blob: Blob) => { downloaded.push(blob); } } as unknown as FileDownloader,
    new ExportProgressStore(),
    { execute: async () => undefined } as unknown as SaveProjectAction,
    new ExportRunTelemetry(
      telemetry,
      store,
      new SheetCustomizationDiff(),
      { describe: () => ({ error_name: 'x' }) } as unknown as AppErrorTelemetryDescriber,
      new VideoCompositionTelemetryDescriber(
        mediaAssets,
        new GraphicTelemetryDescriber(new BuiltinGraphicPresetCatalog(), new BuiltinGraphicPresetCatalog()),
        new ColorGradeLooks(),
      ),
    ),
    { report: () => undefined } as unknown as NonBlockingFailureReporter,
    { begin: () => ({ wasHidden: false, currentState: 'visible', end: () => undefined }) } as unknown as VisibilityTracker,
    accessPolicy,
    false,
    mediaAssets,
    new OriginalCaptionTrackReader(),
    { codecFor: async () => mixCodec },
    new ExportRenderPlanRequestBuilder(),
    new ExportRenderJobBuilder(),
  );

  const cancel = new CancelExportAction(cancelCoordinator, pause);

  return { action, cancel, store, renderer, writer, telemetry, exportStore, downloaded, originalVideoResolver, pause, mediaAssets };
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
      expect((job?.video as File | undefined)?.name).toBe('clip.mp4');
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

    // The preview numbers the captions it shows, cuts applied, and colours a
    // sequential rotation by that count. Counting a caption the cuts removed
    // would hand every caption after it the next caption's colour.
    it('colours a sequential rotation over the captions the cuts leave, in their order', async () => {
      const palette = ['#111111', '#222222', '#333333'];
      const styleValues = new StyleValues([], {
        'color-recipe': 'sequential',
        'highlight-color-1': palette[0]!,
        'highlight-color-2': palette[1]!,
        'highlight-color-3': palette[2]!,
      });
      loadProject(harness.store, [buildSheet('main', styleValues)], buildCaptionsDocument('main', [
        { id: 'first', words: [{ id: 'w1', text: 'one', start: 0, end: 1 }] },
        { id: 'removed', words: [{ id: 'w2', text: 'two', start: 2, end: 3 }] },
        { id: 'third', words: [{ id: 'w3', text: 'three', start: 4, end: 5 }] },
        { id: 'fourth', words: [{ id: 'w4', text: 'four', start: 6, end: 7 }] },
      ]));
      harness.store.patch({ cuts: CutRegistry.fromSnapshot([{ startSec: 1.5, endSec: 3.5 }]) });

      await harness.action.execute(DEFAULT_OPTIONS);

      const overrides = harness.renderer.lastJob?.styles['main']?.segmentOverrides;
      const colours = ['first', 'third', 'fourth'].map((id) => overrides?.get(id)?.inlineStyles?.['--tscaps-highlight-color']);
      expect(colours).toEqual(palette);
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

    it('paints a blended word and a blended scene apart, over the video frame', async () => {
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));
      harness.store.patch({
        elementStyles: ElementStyles.empty()
          .withBlend('w1', 'word', 'difference')
          .withBlend('main-segment', 'segment', 'difference'),
      });

      await harness.action.execute(DEFAULT_OPTIONS);

      const style = harness.renderer.lastJob?.styles['main'];
      for (const override of [
        style?.subtreeOverrides?.get('w1'),
        style?.segmentOverrides?.get('main-segment'),
      ]) {
        expect(override?.blendMode).toBe(CaptionBlendMode.DIFFERENCE);
      }
    });

    it('paints a word a contributor puts under the top layer apart, and the rest of its scene over it', async () => {
      const contributor: ExportRenderContributor = {
        prepare: async () => ({
          segmentClasses: new Map(),
          topLayer: null,
          elementsUnderTopLayer: new Set(['w1']),
          footage: null,
          unavailableFootage: [],
          audioMix: null,
          unavailableAudio: [], audioLayerFileNames: new Map(),
        }),
      };
      harness = buildHarness([contributor]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
        { id: 'w2', text: 'there', start: 1, end: 2 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);

      const style = harness.renderer.lastJob?.styles['main'];
      expect(style?.segmentOverrides?.get('main-segment')?.stacking).toBe(CaptionStacking.OVER_TOP_LAYER);
      expect(style?.subtreeOverrides?.get('w1')?.stacking).toBe(CaptionStacking.UNDER_TOP_LAYER);
      expect(style?.subtreeOverrides?.get('w2')).toBeUndefined();
    });

    it('carries the segment classes and top layer a contributor supplies', async () => {
      const topLayer = { paint: () => undefined } as never;
      const contributor: ExportRenderContributor = {
        prepare: async () => ({
          segmentClasses: new Map([['main-segment', ['behind-actor']]]),
          topLayer,
          elementsUnderTopLayer: new Set<string>(),
          footage: null,
          unavailableFootage: [],
          audioMix: null,
          unavailableAudio: [], audioLayerFileNames: new Map(),
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

    it('carries the footage a contributor draws, and the stylesheet it is drawn by', async () => {
      const layer: FootageLayer = {
        id: 'clip',
        source: { kind: 'video', blob: new Blob(['clip']) },
        outputStartSec: 0,
        outputEndSec: 1,
        sourceStartSec: 0,
        sourcePassSec: 1,
      };
      const footage: RenderFootage = { layers: [layer], style: { css: '', frameWidth: 1080, frameHeight: 1920 } };
      harness = buildHarness([footageContributor(footage, [])]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.footage).toBe(footage);
    });

    it('asks before going without footage that could not be had, and burns nothing when declined', async () => {
      harness = buildHarness([footageContributor(null, ['beach.mp4'])]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.pause).toEqual({
        kind: 'footage-unavailable',
        fileNames: ['beach.mp4'],
      }));
      harness.pause.resume(false);
      await run;

      expect(harness.renderer.lastJob).toBeNull();
      expect(harness.exportStore.run).toBeNull();
      expect(harness.store.snapshot().error).toBeNull();
      expect(harness.telemetry.propertiesOf('export_files_unavailable_prompted')).toEqual({
        kind: 'footage',
        file_count: 1,
        accepted: false,
      });
      expect(harness.telemetry.propertiesOf('export_cancelled')).toMatchObject({ reason: 'declined-missing-files' });
    });

    it('waits for the footage the shots show in a phase of its own, and moves on once it lands', async () => {
      let land: () => void = () => {};
      const slowFootage: ExportRenderContributor = {
        prepare: () => new Promise((resolve) => {
          land = () => resolve({ segmentClasses: new Map(), topLayer: null, elementsUnderTopLayer: new Set(), footage: null, unavailableFootage: [], audioMix: null, unavailableAudio: [], audioLayerFileNames: new Map() });
        }),
      };
      harness = buildHarness([slowFootage]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));
      harness.store.patch({
        shots: ShotPartition.fromSnapshot({
          maxShotSec: 6,
          shots: [{ id: 'shot', startSec: 0, layers: [{ id: 'layer', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] }],
        }),
      });

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.phase).toBe('awaiting-footage'));
      land();
      await run;

      expect(harness.renderer.lastJob).not.toBeNull();
    });

    it('ends a run cancelled while its footage came down, without asking about footage it could not have', async () => {
      let land: () => void = () => {};
      const footageLandingLate: ExportRenderContributor = {
        prepare: () => new Promise((resolve) => {
          land = () => resolve({ segmentClasses: new Map(), topLayer: null, elementsUnderTopLayer: new Set(), footage: null, unavailableFootage: ['beach.mp4'], audioMix: null, unavailableAudio: [], audioLayerFileNames: new Map() });
        }),
      };
      harness = buildHarness([footageLandingLate]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));
      harness.store.patch({
        shots: ShotPartition.fromSnapshot({
          maxShotSec: 6,
          shots: [{ id: 'shot', startSec: 0, layers: [{ id: 'layer', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] }],
        }),
      });

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.phase).toBe('awaiting-footage'));
      harness.cancel.execute('user');
      land();
      await run;

      expect(harness.exportStore.run).toBeNull();
      expect(harness.exportStore.cancellation).toBe('user');
      expect(harness.renderer.lastJob).toBeNull();
      expect(harness.telemetry.names()).toContain('export_cancelled');
    });

    it('burns without the missing footage once told to', async () => {
      harness = buildHarness([footageContributor(null, ['beach.mp4'])]);
      loadProject(harness.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 0, end: 1 },
      ]));

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.pause?.kind).toBe('footage-unavailable'));
      harness.pause.resume(true);
      await run;

      expect(harness.renderer.lastJob).not.toBeNull();
    });
  });

  describe('the soundtrack', () => {

    const WHOOSH: AudioClip = {
      id: 'whoosh on hello',
      role: 'effect',
      source: { kind: 'media', mediaId: 'whoosh' },
      start: { anchor: { kind: 'word', wordId: 'w1', edge: 'start' }, offsetSec: 0 },
      end: null,
      inSec: 0,
      loop: false,
      volume: 1,
      fadeInSec: 0,
      fadeOutSec: 0,
      ducking: { enabled: false, depthDb: -12 },
    };
    const LOST: AudioClip = { ...WHOOSH, id: 'lost on hello', source: { kind: 'media', mediaId: 'lost' } };

    function soundtrackHarness(held: ReadonlyArray<string>, mixCodec: string | null = 'aac'): Harness {
      const built = buildHarness([audioMixContributor(held)], new UnrestrictedExportAccessPolicy(), mixCodec);
      loadProject(built.store, [buildSheet('main')], buildDocument('main', [
        { id: 'w1', text: 'hello', start: 2, end: 3 },
      ]));
      built.mediaAssets.replace([audioAsset('whoosh'), audioAsset('lost')]);
      return built;
    }

    function addClips(store: EditorStore, ...clips: AudioClip[]): void {
      store.patch({ audio: clips.reduce((mix, added) => mix.withClipAdded(added), AudioMix.empty()) });
    }

    it('mixes the clips with the video, where the edit places them', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH);

      await harness.action.execute(DEFAULT_OPTIONS);

      const layers = harness.renderer.lastJob?.audioMix?.layers ?? [];
      expect(layers.map((layer) => [layer.id, layer.outputStartSec])).toEqual([['whoosh on hello', 2]]);
      expect(harness.telemetry.propertiesOf('export_completed')).toMatchObject({
        audio_mix_layers: 1,
        audio_mix_codec: 'aac',
        audio_mix_dropped: null,
        audio_mix_input_fallback: null,
      });
    });

    it('hands the renderer no soundtrack for a project without clips', async () => {
      harness = soundtrackHarness(['whoosh']);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audioMix).toBeUndefined();
    });

    it('carries the clips into an export of the captions alone that keeps the audio', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH);

      await harness.action.execute({ ...DEFAULT_OPTIONS, background: { kind: 'transparent' }, audio: 'keep' });

      expect(harness.renderer.lastJob?.audioMix?.layers).toHaveLength(1);
    });

    it('leaves the clips out of an export that leaves the audio out, and asks nothing about their files', async () => {
      harness = soundtrackHarness([]);
      addClips(harness.store, WHOOSH);

      await harness.action.execute({ ...DEFAULT_OPTIONS, background: { kind: 'transparent' }, audio: 'discard' });

      expect(harness.renderer.lastJob?.audioMix).toBeUndefined();
      expect(harness.renderer.lastJob?.audio).toBe('discard');
    });

    it('asks before mixing without a sound file it could not have, and burns nothing when declined', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH, LOST);

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.pause).toEqual({
        kind: 'audio-unavailable',
        fileNames: ['lost.mp3'],
      }));
      harness.pause.resume(false);
      await run;

      expect(harness.renderer.lastJob).toBeNull();
      expect(harness.exportStore.cancellation).toBe('declined-missing-files');
      expect(harness.telemetry.propertiesOf('export_files_unavailable_prompted')).toEqual({
        kind: 'sounds',
        file_count: 1,
        accepted: false,
      });
    });

    it('goes without the sound of a b-roll whose file has none, asking nothing', async () => {
      harness = soundtrackHarness([]);
      harness.mediaAssets.replace([{ ...audioAsset('silent'), type: 'video', fileName: 'silent.mp4', mimeType: 'video/mp4', widthPx: 2, heightPx: 2, durationSec: 1 }]);
      harness.store.patch({
        shots: ShotPartition.fromSnapshot({
          maxShotSec: 4,
          shots: [{ id: 'opening', startSec: 0, layers: [{ id: 'layer', mediaId: 'silent', inSec: 0, outSec: null, loop: false }] }],
        }),
        audio: AudioMix.empty().withFootageSound(['layer'], 1),
      });

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob).not.toBeNull();
      expect(harness.renderer.lastJob?.audioMix?.layers ?? []).toEqual([]);
    });

    it('mixes the sounds it could have once told to go without the rest', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH, LOST);

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.pause?.kind).toBe('audio-unavailable'));
      harness.pause.resume(true);
      await run;

      expect(harness.renderer.lastJob?.audioMix?.layers.map((layer) => layer.id)).toEqual(['whoosh on hello']);
      expect(harness.telemetry.propertiesOf('export_completed')['audio_mix_files_unavailable']).toBe(1);
    });

    it('asks the same question when a sound it had turns out not to decode, naming its file, and goes on once told to', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH);
      harness.renderer.undecodableAudioLayerIds = ['whoosh on hello'];

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await vi.waitFor(() => expect(harness.exportStore.run?.pause).toEqual({
        kind: 'audio-unavailable',
        fileNames: [harness.mediaAssets.snapshot().get('whoosh')!.fileName],
      }));
      harness.pause.resume(true);
      await run;

      expect(harness.renderer.wentOnWithoutUndecodable).toBe(true);
    });

    it('leaves the clips out before the run when this browser can write no codec for them, and says so after', async () => {
      harness = soundtrackHarness(['whoosh'], null);
      addClips(harness.store, WHOOSH, LOST);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audioMix).toBeUndefined();
      expect(harness.exportStore.run).toBeNull();
      expect(harness.exportStore.notice).toEqual({ kind: 'audio-mix-dropped', reason: 'no-encodable-target-codec', format: 'mp4' });
      expect(harness.telemetry.propertiesOf('export_completed')['audio_mix_dropped']).toBe('no-encodable-target-codec');
    });

    function setSourceVolume(store: EditorStore, volume: number): void {
      store.patch({ audio: store.snapshot().audio.withSourceVolume(volume) });
    }

    it('mixes the video at another level than its own without any clip', async () => {
      harness = soundtrackHarness([]);
      setSourceVolume(harness.store, 1.5);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audioMix).toEqual({ layers: [], inputGain: 1.5, inputDucks: [] });
      expect(harness.renderer.lastJob?.audio).toBeUndefined();
    });

    it('mixes the video with its own sound off over a muted shot, and a b-roll heard from its own file', async () => {
      harness = soundtrackHarness(['broll']);
      harness.mediaAssets.replace([{ ...audioAsset('broll'), type: 'video', fileName: 'broll.mp4', mimeType: 'video/mp4', widthPx: 2, heightPx: 2, durationSec: 1 }]);
      harness.store.patch({
        shots: ShotPartition.fromSnapshot({
          maxShotSec: 4,
          shots: [{ id: 'opening', startSec: 0 }, { id: 'cutaway', startSec: 1, layers: [{ id: 'layer', mediaId: 'broll', inSec: 0, outSec: null, loop: false }] }],
        }),
        audio: AudioMix.empty().withShotVideoVolume(['cutaway'], 0).withFootageSound(['layer'], 0.8),
      });

      await harness.action.execute(DEFAULT_OPTIONS);

      const mix = harness.renderer.lastJob?.audioMix;
      expect(mix?.layers.map((layer) => [layer.id, layer.outputStartSec, layer.gain])).toEqual([['footage:layer', 1, 0.8]]);
      expect(mix?.inputDucks?.map((duck) => [duck.gain, duck.ranges])).toEqual([[0, [{ startSec: 1, endSec: 10 }]]]);
    });

    it('leaves the video\'s own sound out of the file when it is turned all the way down, mixing nothing for it', async () => {
      harness = soundtrackHarness([]);
      setSourceVolume(harness.store, 0);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audio).toBe('discard');
      expect(harness.renderer.lastJob?.audioMix).toBeUndefined();
    });

    it('still mixes the clips over a video turned all the way down', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH);
      setSourceVolume(harness.store, 0);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audio).toBe('discard');
      expect(harness.renderer.lastJob?.audioMix?.layers.map((layer) => layer.id)).toEqual(['whoosh on hello']);
    });

    it('writes the video at its own level, saying nothing, where no codec can write another level', async () => {
      harness = soundtrackHarness([], null);
      setSourceVolume(harness.store, 1.5);

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audioMix).toBeUndefined();
      expect(harness.exportStore.notice).toBeNull();
    });

    it('says nothing about sounds when the render could not change the video\'s level', async () => {
      harness = soundtrackHarness([]);
      setSourceVolume(harness.store, 1.5);
      harness.renderer.dropsAudioMixWith = 'undecodable-input-audio';

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.renderer.lastJob?.audioMix?.inputGain).toBe(1.5);
      expect(harness.exportStore.notice).toBeNull();
    });

    it('says the clips are not in the file when the render had to leave them out', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH);
      harness.renderer.dropsAudioMixWith = 'undecodable-input-audio';

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.exportStore.notice).toEqual({ kind: 'audio-mix-dropped', reason: 'undecodable-input-audio', format: 'mp4' });
      expect(harness.telemetry.propertiesOf('export_completed')['audio_mix_dropped']).toBe('undecodable-input-audio');
    });

    it('reports the error the video\'s sound fell back from, and shows nothing, when the render mixed it all the same', async () => {
      harness = soundtrackHarness(['whoosh']);
      addClips(harness.store, WHOOSH);
      harness.renderer.fallsBackOnInputAudioFrom = new DOMException('Decoding error.', 'EncodingError');

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.exportStore.notice).toBeNull();
      expect(harness.telemetry.propertiesOf('export_completed')).toMatchObject({
        audio_mix_dropped: null,
        audio_mix_input_fallback: 'EncodingError: Decoding error.',
      });
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

    it('records that the render had moved to the software encoder when it failed', async () => {
      harness.renderer.encoderSelection = {
        acceleration: 'prefer-software',
        defaultEncoderFailure: 'OperationError: Encoding error. (Unexpected frame format.)',
        softwareEncoderFailure: null,
      };
      harness.renderer.failWith = new Error('encoder died');

      await harness.action.execute(DEFAULT_OPTIONS);

      const properties = harness.telemetry.propertiesOf('export_failed');
      expect(properties['video_encoder_acceleration']).toBe('prefer-software');
      expect(properties['video_encoder_fallback']).toBe('software');
    });

    it('counts a dismissed save prompt as a cancellation, not a failure', async () => {
      harness.renderer.failWith = Object.assign(new Error('gone'), { name: 'AbortError' });

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.telemetry.names()).toContain('export_cancelled');
      expect(harness.telemetry.names()).not.toContain('export_failed');
      expect(harness.store.snapshot().error).toBeNull();
      expect(harness.exportStore.cancellation).toBe('user');
    });

    it('abandons a render in flight when cancelled, keeping nothing and saying why', async () => {
      harness.renderer.runsUntilAborted = true;

      const run = harness.action.execute(DEFAULT_OPTIONS);
      await harness.renderer.started;
      harness.cancel.execute('user');
      await run;

      expect(harness.writer.aborted).toBe(true);
      expect(harness.downloaded).toHaveLength(0);
      expect(harness.store.snapshot().error).toBeNull();
      expect(harness.exportStore.run).toBeNull();
      expect(harness.exportStore.cancellation).toBe('user');
      expect(harness.telemetry.propertiesOf('export_cancelled')).toMatchObject({
        reason: 'user',
        progress_percent: 50,
      });
    });

    it('leaves the next run untouched by a cancellation that arrived after the last one ended', async () => {
      await harness.action.execute(DEFAULT_OPTIONS);
      harness.cancel.execute('user');

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.downloaded).toHaveLength(2);
      expect(harness.exportStore.cancellation).toBeNull();
    });

    it('reports how far the failed run had got', async () => {
      harness.renderer.failWith = new Error('encoder died');

      await harness.action.execute(DEFAULT_OPTIONS);

      expect(harness.telemetry.propertiesOf('export_failed')['progress_percent']).toBe(50);
    });
  });
});

function footageContributor(
  footage: ExportRenderContribution['footage'],
  unavailableFootage: ReadonlyArray<string>,
): ExportRenderContributor {
  return {
    prepare: async () => ({ segmentClasses: new Map(), topLayer: null, elementsUnderTopLayer: new Set(), footage, unavailableFootage, audioMix: null, unavailableAudio: [], audioLayerFileNames: new Map() }),
  };
}

function audioAsset(id: string): MediaAsset {
  return {
    id,
    type: 'audio',
    owner: { kind: 'library' },
    fileName: `${id}.mp3`,
    mimeType: 'audio/mpeg',
    sizeBytes: 3,
    widthPx: null,
    heightPx: null,
    durationSec: 0.5,
  };
}

/** The soundtrack's contributor, over files held in memory: those named are had, the rest are not. */
function audioMixContributor(held: ReadonlyArray<string>): ExportRenderContributor {
  const files: AudioSourceFiles = {
    load: async (source) => (source.kind === 'media' && held.includes(source.mediaId) ? new Blob([source.mediaId]) : null),
  };
  return new AudioMixExportContributor(
    new AudioMixLayerBuilder(new AudioAnchorTiming(new ShotLayerTiming(new ShotLayerAssetReader()), new ShotLayerSplitTransitions(), new ShotLayerInsetTransitions(), new ShotTransitionCuts(), new DecorationFilter(new DecorationVisibility())), new SpeechSpanReader(), new FootageSoundReader(new ShotLayerTiming(new ShotLayerAssetReader()))),
    new RenderAudioMixBuilder(),
    files,
    new StaticFileBuiltinSoundCatalog([{ id: 'pop-01', name: 'Pop', category: 'pop', lengthSec: 0.3, description: '', underVoiceVolume: 0.15 }], '/'),
  );
}
