import { RenderTimeMap, type StillFrameJob, type StillFrameRenderer, type StillFrameSession } from '@tscaps/engine';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import type { ExportRenderOutsideInput } from '@core/export/domain/ExportRenderOutsideInput';
import type { ExportRenderPlan, ExportRenderPlanRequest, ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import type { ExportRenderPlanRequestBuilder } from '@core/export/services/ExportRenderPlanRequestBuilder';
import type { ExportRenderJobBuilder } from '@core/export/services/ExportRenderJobBuilder';

/** How long planning waits for the files the shots show before it draws without them. */
const FILE_WAIT_MS = 3_000;

/** One picture of the project's output frame. */
export interface ProjectFrame {
  /** The source time asked for. */
  readonly sourceSec: number;
  /** The source time of the video frame drawn: the one on screen at `sourceSec`, or the first one after the cut it falls in. */
  readonly frameSourceSec: number;
  /** Where that frame lands in the exported video, with the cuts taken out. */
  readonly outputSec: number;
  /** The output frame at its full size. The receiver closes it. */
  readonly bitmap: ImageBitmap;
}

/** Pictures of the project's output frame, and what they leave out or stand in for. */
export interface ProjectFrames {
  /** One per time asked, in the order asked, except times whose picture could not be drawn. */
  readonly frames: ReadonlyArray<ProjectFrame>;
  readonly width: number;
  readonly height: number;
  /** Plain sentences on how the pictures differ from the export, or why one is missing. */
  readonly notes: ReadonlyArray<string>;
}

/** The video a session reads, and what it is. */
interface StillVideo {
  readonly bytes: Blob;
  /** Whether it is the preview's reduced copy rather than the original. */
  readonly reduced: boolean;
  readonly notes: ReadonlyArray<string>;
}

/** A plan, with what it leaves out, and whether it waited for every file it needed. */
interface StillPlan {
  readonly plan: ExportRenderPlan;
  readonly notes: ReadonlyArray<string>;
  readonly complete: boolean;
}

/** An open session and what it was opened from. */
interface WarmSession {
  readonly inputs: ReadonlyArray<unknown>;
  readonly session: StillFrameSession;
  readonly notes: ReadonlyArray<string>;
  /** False when the plan went without files that may yet arrive, so the next call plans again. */
  readonly reusable: boolean;
}

/**
 * Pictures of the project's output frame at source times, as the export
 * draws them: the video, the shots' layers and graphics, the camera,
 * transitions, colour grade and captions, with the actor cut out over
 * them where the text-behind-actor effect has been measured. Nothing
 * laid over every export is drawn, and there is no sound.
 *
 * The plan is the export's, made by the same planner from the same
 * editor state, and painted by the engine's still renderer, which paints
 * the way a render paints. What differs from the export is said in the
 * notes: a picture drawn from the preview's reduced copy of the video,
 * files left out, a time that falls in a cut or past the end, a picture
 * that could not be drawn.
 *
 * One session is kept open between calls and opened again only when
 * something it was planned from has changed, so a run of questions about
 * one state of the project pays for opening once. Calls are served one
 * at a time.
 */
export class ProjectFrameRenderer {

  private warm: WarmSession | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly editorStore: EditorStore,
    private readonly mediaAssets: MediaAssetStore,
    private readonly originalVideoResolver: OriginalVideoResolver,
    private readonly planRequests: ExportRenderPlanRequestBuilder,
    private readonly planner: ExportRenderPlanner,
    private readonly jobs: ExportRenderJobBuilder,
    private readonly stills: StillFrameRenderer,
    private readonly outsideInputs: ReadonlyArray<ExportRenderOutsideInput>,
  ) {}

  /**
   * Pictures at `sourceSecs`, seconds of the source video before cuts.
   * Rejects when the project has no captions yet or no copy of its video
   * can be read here, and with an `AbortError` once `signal` aborts; a
   * single time that cannot be drawn is left out and explained in the
   * notes instead.
   */
  renderAt(sourceSecs: ReadonlyArray<number>, signal: AbortSignal, withCaptions = true): Promise<ProjectFrames> {
    return this.oneAtATime(() => this.render(sourceSecs, signal, withCaptions));
  }

  /** Closes the session kept open, letting go of the decoders and pages it holds. The next call opens a new one. */
  release(): Promise<void> {
    return this.oneAtATime(() => this.closeWarm());
  }

  private oneAtATime<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async render(sourceSecs: ReadonlyArray<number>, signal: AbortSignal, withCaptions: boolean): Promise<ProjectFrames> {
    signal.throwIfAborted();
    const snapshot = this.editorStore.snapshot();
    if (snapshot.document === null) throw new Error('The project has no captions to render yet.');
    // A document with no words draws every caption out; the session it opens is set aside by the next call with them.
    const state = withCaptions ? snapshot : { ...snapshot, document: snapshot.document.with({ sections: [] }) };
    const warm = await this.warmFor(state, signal);
    const notes = [...warm.notes];
    const frames: ProjectFrame[] = [];
    try {
      for (const asked of sourceSecs) {
        signal.throwIfAborted();
        const frame = await this.frameAt(warm.session, asked, state, notes);
        if (frame !== null) frames.push(frame);
      }
    } catch (error) {
      for (const frame of frames) frame.bitmap.close();
      throw error;
    }
    return { frames, width: warm.session.width, height: warm.session.height, notes };
  }

  private async frameAt(
    session: StillFrameSession,
    asked: number,
    state: EditorState,
    notes: string[],
  ): Promise<ProjectFrame | null> {
    const sourceSec = this.withinVideo(asked, state, notes);
    try {
      const still = await session.frameAt(sourceSec);
      const cut = new RenderTimeMap(state.cuts.list()).findContainingRange(sourceSec);
      if (cut !== null) {
        notes.push(`${this.seconds(asked)} s is cut out of the video; its picture is the first frame after the cut, at ${this.seconds(still.sourceSec)} s.`);
      }
      return { sourceSec: asked, frameSourceSec: still.sourceSec, outputSec: still.outputSec, bitmap: still.bitmap };
    } catch (error) {
      notes.push(`No picture at ${this.seconds(asked)} s: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /** `asked` brought inside the video, saying so when it was not. */
  private withinVideo(asked: number, state: EditorState, notes: string[]): number {
    const durationSec = state.video.duration;
    if (asked < 0) {
      notes.push(`${this.seconds(asked)} s is before the video starts; its picture is the first frame.`);
      return 0;
    }
    if (durationSec > 0 && asked >= durationSec) {
      notes.push(`${this.seconds(asked)} s is past the end of the video (${this.seconds(durationSec)} s); its picture is the last frame.`);
      return durationSec;
    }
    return asked;
  }

  private async warmFor(state: EditorState, signal: AbortSignal): Promise<WarmSession> {
    const video = await this.videoFor(state);
    const inputs = this.inputsOf(state, video);
    if (this.warm !== null && this.warm.reusable && this.sameInputs(this.warm.inputs, inputs)) return this.warm;
    await this.closeWarm();
    const planned = await this.plan(state, signal);
    const opened = await this.open(planned.plan, video, state);
    // Kept before the abort is checked, so a session opened for a call abandoned meanwhile serves the next.
    this.warm = {
      inputs,
      session: opened.session,
      notes: [...opened.notes, ...planned.notes],
      reusable: planned.complete,
    };
    signal.throwIfAborted();
    return this.warm;
  }

  /** Every input the plan and the session are made from, by identity. */
  private inputsOf(state: EditorState, video: StillVideo): ReadonlyArray<unknown> {
    return [
      state.document,
      state.sheets,
      state.elementStyles,
      state.decorationOverrides,
      state.cuts,
      state.behindActorOverrides,
      state.frameLayout,
      state.outputFrame,
      state.colorGrade,
      state.shots,
      state.projectId,
      this.mediaAssets.snapshot(),
      video.bytes,
      ...this.outsideInputs.map((input) => input.current),
    ];
  }

  private sameInputs(held: ReadonlyArray<unknown>, now: ReadonlyArray<unknown>): boolean {
    return held.length === now.length && held.every((input, i) => Object.is(input, now[i]));
  }

  /** The original where this tab can read it, else the copy the preview plays. Never waits on a download. */
  private async videoFor(state: EditorState): Promise<StillVideo> {
    const original = await this.originalVideoResolver.readableFileInEditor();
    if (original !== null) return { bytes: original, reduced: false, notes: [] };
    const preview = state.video.preview;
    if (preview === null) throw new Error('No copy of the video can be read in this tab yet.');
    if (preview.kind === 'original') {
      return { bytes: preview.file, reduced: false, notes: ['The pictures are drawn from the copy of the video the preview plays.'] };
    }
    return { bytes: preview.file, reduced: true, notes: [this.reducedCopyNote('the original video cannot be read in this tab')] };
  }

  /**
   * The project's plan, waiting a short while for the files its shots
   * show. Once that wait runs out, it is planned again without any shot
   * file, graphics and the video itself still drawn, and the next call
   * plans afresh.
   */
  private async plan(state: EditorState, signal: AbortSignal): Promise<StillPlan> {
    const waiting = AbortSignal.any([signal, AbortSignal.timeout(FILE_WAIT_MS)]);
    try {
      const plan = await this.planner.plan(this.requestFor(state, this.mediaAssets.snapshot(), waiting));
      return { plan, notes: this.unavailableNotes(plan.unavailableFootage), complete: true };
    } catch (error) {
      if (signal.aborted || !waiting.aborted) throw error;
      const plan = await this.planner.plan(this.requestFor(state, MediaAssetCatalog.empty(), signal));
      const coming = [...state.shots.mediaIdsInUse()].map((mediaId) => this.mediaAssets.snapshot().get(mediaId)?.fileName || mediaId);
      return {
        plan,
        notes: [`Files the shots show were still coming down to this device, so the pictures leave them out: ${coming.join(', ')}.`],
        complete: false,
      };
    }
  }

  private requestFor(state: EditorState, media: MediaAssetCatalog, signal: AbortSignal): ExportRenderPlanRequest {
    // No soundtrack: a picture has no sound, and the soundtrack's word anchors are then never read.
    return this.planRequests.build(state, {
      originalDocument: null,
      originalSheets: [],
      originalDecorationOverrides: DecorationOverrideRegistry.empty(),
      audio: AudioMix.empty(),
      media,
      signal,
    });
  }

  private unavailableNotes(fileNames: ReadonlyArray<string>): string[] {
    if (fileNames.length === 0) return [];
    return [`Files the shots show could not be read, so the pictures leave them out, as the export would: ${fileNames.join(', ')}.`];
  }

  /**
   * A session on `video`; where the original cannot be opened here and
   * the preview has a reduced copy, a session on that copy instead.
   */
  private async open(plan: ExportRenderPlan, video: StillVideo, state: EditorState): Promise<{ session: StillFrameSession; notes: ReadonlyArray<string> }> {
    try {
      return { session: await this.stills.open(this.jobFor(plan, video, state)), notes: video.notes };
    } catch (error) {
      const preview = state.video.preview;
      if (video.reduced || preview === null || preview.kind !== 'proxy') throw error;
      const reduced: StillVideo = { bytes: preview.file, reduced: true, notes: [] };
      const reason = `the original video cannot be opened here (${error instanceof Error ? error.message : String(error)})`;
      return { session: await this.stills.open(this.jobFor(plan, reduced, state)), notes: [this.reducedCopyNote(reason)] };
    }
  }

  /**
   * The export's job for `plan` on `video`. A reduced copy is laid out on
   * the output frame's own size, so everything drawn over the video lands
   * where the export puts it and only the video's own picture is softer.
   */
  private jobFor(plan: ExportRenderPlan, video: StillVideo, state: EditorState): StillFrameJob {
    const picture = this.jobs.pictureOf(plan);
    const frame = picture.frame ?? (video.reduced ? state.frameLayout : null);
    return {
      ...picture,
      video: video.bytes instanceof File ? video.bytes : new File([video.bytes], 'video', { type: video.bytes.type }),
      ...(frame ? { frame } : {}),
    };
  }

  private reducedCopyNote(reason: string): string {
    return `The pictures are drawn from the preview's reduced copy of the video, since ${reason}: the video itself looks softer than in the export, and everything drawn over it is as the export draws it.`;
  }

  private async closeWarm(): Promise<void> {
    const warm = this.warm;
    this.warm = null;
    await warm?.session.close();
  }

  private seconds(value: number): string {
    return value.toFixed(2);
  }
}
