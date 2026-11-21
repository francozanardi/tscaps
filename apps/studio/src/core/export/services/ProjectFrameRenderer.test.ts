import { describe, expect, it } from 'vitest';
import {
  Document,
  Line,
  Section,
  Segment,
  TimeFragment,
  Word,
  type StillFrame,
  type StillFrameJob,
  type StillFrameRenderer,
  type StillFrameSession,
} from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import { SegmentSubtreeOverridesBuilder } from '@core/captions/services/SegmentSubtreeOverridesBuilder';
import { ElementBlendResolver } from '@core/elements/services/ElementBlendResolver';
import { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';
import { ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import { ExportRenderPlanRequestBuilder } from '@core/export/services/ExportRenderPlanRequestBuilder';
import { ExportRenderJobBuilder } from '@core/export/services/ExportRenderJobBuilder';
import { ProjectFrameRenderer } from '@core/export/services/ProjectFrameRenderer';
import type { ExportRenderOutsideInput } from '@core/export/domain/ExportRenderOutsideInput';
import type { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import type { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import type { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { DecorationFilter } from '@core/captions/services/DecorationFilter';

/**
 * Pictures of the project at given times: what job reaches the still
 * renderer, how long a session is kept, and what is said when a picture
 * is not quite the export's.
 *
 * The still renderer is an in-memory one that records the jobs it opens
 * and whether each session was closed; that a superseded session is
 * closed is a promise in its own right, since it holds decoders and
 * pages nothing else lets go of.
 */

/** A session whose pictures carry nothing but the time asked; a time listed in `failing` cannot be drawn. */
class RecordedSession implements StillFrameSession {
  readonly width = 1080;
  readonly height = 1920;
  closed = false;

  constructor(private readonly failing: ReadonlySet<number>) {}

  async frameAt(sourceSec: number): Promise<StillFrame> {
    if (this.failing.has(sourceSec)) throw new Error('a graphic did not draw');
    return { bitmap: { close: () => undefined } as unknown as ImageBitmap, sourceSec, outputSec: sourceSec };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class RecordingStillRenderer implements StillFrameRenderer {
  readonly jobs: StillFrameJob[] = [];
  readonly sessions: RecordedSession[] = [];
  failing = new Set<number>();
  /** Videos whose session cannot be opened, as one this browser cannot decode. */
  refusing = new Set<string>();

  async open(job: StillFrameJob): Promise<StillFrameSession> {
    if (this.refusing.has((job.video as File).name)) throw new Error('This browser cannot decode the input\'s video (hvc1).');
    this.jobs.push(job);
    const session = new RecordedSession(this.failing);
    this.sessions.push(session);
    return session;
  }
}

class OutsideMeasurement implements ExportRenderOutsideInput {
  current: unknown = {};
}

interface Harness {
  readonly frames: ProjectFrameRenderer;
  readonly stills: RecordingStillRenderer;
  readonly store: EditorStore;
  readonly measurement: OutsideMeasurement;
  readonly original: { readable: boolean };
}

function captions(text: string): Document {
  return new Document({
    sections: [new Section({
      id: 'section', kind: 'main',
      segments: [new Segment({ id: 's1', lines: [new Line({ id: 'l1', words: [new Word({ id: 'w1', text, time: new TimeFragment(0, 2) })] })] })],
    })],
  });
}

function buildHarness(): Harness {
  const store = new EditorStore();
  const original = { readable: true };
  const originalFile = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' });
  store.patch({ document: captions('hello') });
  store.patchVideo({
    file: originalFile,
    fileName: 'clip.mp4',
    layout: { width: 1080, height: 1920 },
    duration: 10,
    preview: { kind: 'proxy', file: new File(['small'], 'proxy.mp4', { type: 'video/mp4' }) },
  });
  const resolver = { readableFileInEditor: async () => (original.readable ? originalFile : null) } as unknown as OriginalVideoResolver;
  // What the style builders produce is their own promise, covered where they live.
  const styleSetBuilder = new SubtitleStyleSetBuilder(
    { build: () => ({}) } as unknown as SheetCssVarsBuilder,
    { build: () => '' } as unknown as LayeredCaptionCssBuilder,
    { build: () => ({ subtreeBySheet: {}, segmentsBySheet: {} }) } as unknown as CaptionFontOverridesBuilder,
    new SegmentColorRotation(),
    { build: () => '' } as unknown as SheetFontFacesBuilder,
    new DocumentUsedCodepointCollector(),
    { resolve: () => ({}) } as unknown as SheetSvgFilterDefinitionsResolver,
    new DecorationPlacementResolver(),
    new SegmentSubtreeOverridesBuilder(new ElementBlendResolver()),
  );
  const planner = new ExportRenderPlanner(
    new CutAwareDocumentBuilder(),
    { filterDocument: (doc: Document) => doc } as unknown as DecorationFilter,
    styleSetBuilder,
    [],
  );
  const stills = new RecordingStillRenderer();
  const measurement = new OutsideMeasurement();
  const frames = new ProjectFrameRenderer(
    store,
    new MediaAssetStore(),
    resolver,
    new ExportRenderPlanRequestBuilder(),
    planner,
    new ExportRenderJobBuilder(),
    stills,
    [measurement],
  );
  return { frames, stills, store, measurement, original };
}

const NEVER = new AbortController().signal;

describe('ProjectFrameRenderer', () => {
  it('keeps one session while nothing it was planned from changes', async () => {
    const { frames, stills } = buildHarness();

    await frames.renderAt([1], NEVER);
    await frames.renderAt([2, 0.5], NEVER);

    expect(stills.sessions).toHaveLength(1);
    expect(stills.sessions[0]!.closed).toBe(false);
  });

  it('opens a new session on an edit, and closes the one it replaces', async () => {
    const { frames, stills, store } = buildHarness();

    await frames.renderAt([1], NEVER);
    store.patch({ document: captions('goodbye') });
    await frames.renderAt([1], NEVER);

    expect(stills.sessions).toHaveLength(2);
    expect(stills.sessions[0]!.closed).toBe(true);
    expect(stills.jobs[1]!.document.getSegments()[0]!.lines[0]!.words[0]!.text).toBe('goodbye');
  });

  it('opens a new session when a measurement the plan read changes', async () => {
    const { frames, stills, measurement } = buildHarness();

    await frames.renderAt([1], NEVER);
    measurement.current = {};
    await frames.renderAt([1], NEVER);

    expect(stills.sessions).toHaveLength(2);
  });

  it('leaves out a picture that cannot be drawn, says why, and draws the rest', async () => {
    const { frames, stills } = buildHarness();
    stills.failing = new Set([2]);

    const result = await frames.renderAt([1, 2, 3], NEVER);

    expect(result.frames.map((frame) => frame.sourceSec)).toEqual([1, 3]);
    expect(result.notes.join(' ')).toContain('No picture at 2.00 s: a graphic did not draw');
  });

  it('draws from the reduced copy, laid out on the output frame, when the original cannot be read', async () => {
    const { frames, stills, original } = buildHarness();
    original.readable = false;

    const result = await frames.renderAt([1], NEVER);

    expect((stills.jobs[0]!.video as File).name).toBe('proxy.mp4');
    expect(stills.jobs[0]!.frame).toEqual({ width: 1080, height: 1920 });
    expect(result.notes.join(' ')).toContain('reduced copy');
  });

  it('falls back to the reduced copy when the original cannot be opened here', async () => {
    const { frames, stills } = buildHarness();
    stills.refusing = new Set(['clip.mp4']);

    const result = await frames.renderAt([1], NEVER);

    expect(stills.jobs.map((job) => (job.video as File).name)).toEqual(['proxy.mp4']);
    expect(result.notes.join(' ')).toContain('cannot decode');
  });

  it('says when a time falls in a cut, and plans the cut out of the video', async () => {
    const { frames, stills, store } = buildHarness();
    store.patch({ cuts: CutRegistry.fromSnapshot([{ startSec: 4, endSec: 5 }]) });

    const result = await frames.renderAt([4.5], NEVER);

    expect(stills.jobs[0]!.skipRanges).toEqual([{ startSec: 4, endSec: 5 }]);
    expect(result.notes.join(' ')).toContain('4.50 s is cut out of the video');
  });

  it('rejects once its signal aborts', async () => {
    const { frames } = buildHarness();
    const controller = new AbortController();
    controller.abort();

    await expect(frames.renderAt([1], controller.signal)).rejects.toThrow();
  });
});
