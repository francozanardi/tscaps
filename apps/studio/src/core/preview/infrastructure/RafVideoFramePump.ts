import type { RenderTimeMap } from '@tscaps/engine';
import type { VideoFramePump } from '@core/preview/domain/VideoFramePump';
import type { PreviewVideoTrack, PreviewScrubSession } from '@core/preview/domain/PreviewVideoTrack';
import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { FramePainter } from '@core/preview/domain/FramePainter';
import type { PlaybackClock } from '@core/preview/domain/PlaybackClock';
import { FrameBuffer } from '@core/preview/services/FrameBuffer';
import { RafVideoFramePumpDiagnostics } from '@core/preview/infrastructure/RafVideoFramePumpDiagnostics';

const LONG_CUT_SKIP_THRESHOLD_SEC = 2.0;
const PLAYBACK_BUFFER_MAX_FRAMES = 10;
const BUFFER_FULL_BACKOFF_MS = 8;
const CLOCK_RUNAWAY_RESTART_THRESHOLD_SEC = 3.0;
const SINGLE_FRAME_MIN_INTERVAL_MS = 120;
const PUMP_DIAGNOSTICS_ENABLED = false;

interface CutRange {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * {@link VideoFramePump} implementation that drives a
 * {@link FramePainter} from a sequential decode iterator on the
 * {@link PreviewVideoTrack}, decoupling decode pace from paint pace
 * via a {@link FrameBuffer}.
 *
 * Two cooperating loops run while a stream is active. The decode
 * loop pulls frames as fast as the track yields them, classifies
 * each by the live {@link RenderTimeMap}, and pushes the kept ones
 * into the buffer; it backs off when the buffer is full so the
 * iterator naturally back-pressures. Track frames are standalone
 * (see {@link PreviewVideoFrame}), so they enter the buffer as
 * yielded — no per-frame copy on this thread. The paint loop ticks
 * on {@link requestAnimationFrame}, asks the buffer for the latest
 * frame whose target output time the {@link PlaybackClock} has
 * reached, and draws it. Frames that fall behind the clock are
 * dropped by the buffer in the same pull, so transient decode
 * stutters never accumulate visible lag.
 *
 * Frames whose source timestamp falls inside a cut range are
 * dropped without painting. Short cuts (under
 * {@link LONG_CUT_SKIP_THRESHOLD_SEC}) are drained through the
 * same iterator so the decoder stays warm. Long cuts swap the
 * iterator to a fresh decode at the post-cut keyframe — draining
 * a multi-second elided segment at decoder speed would otherwise
 * starve the buffer while the clock has already crossed the cut.
 * Each swap leaks one WebCodecs decoder context into Chrome's
 * hardware pool, so the count of retained contexts is bounded by
 * the number of long cuts traversed, not by their duration — an
 * acceptable cost for the 4K + long-cut edge case.
 *
 * The same swap protects against a runaway clock: if the frames
 * being decoded fall more than
 * {@link CLOCK_RUNAWAY_RESTART_THRESHOLD_SEC} behind the running
 * clock (a long main-thread stall, anything that let wall time
 * advance while decode stood still), the decode loop restarts at
 * the clock's position instead of grinding through the whole gap
 * frame by frame.
 *
 * Decode and paint have independent lifecycles. The decode loop
 * exits as soon as the iterator drains, but the paint loop keeps
 * ticking on the same buffer until {@link cancel} is invoked —
 * otherwise the final buffered frames between "decoder done" and
 * the end of the output timeline would never reach the canvas,
 * leaving the last second of playback visibly frozen.
 * {@link startFromOutputTime} cancels both loops and starts a
 * fresh pair from the requested output position — except while a
 * previous restart is still warming up (no frame decoded yet):
 * then only the newest target is kept and the stream redirects
 * there once the in-flight restart settles, so a burst of rapid
 * seeks costs a couple of decoder allocations instead of one per
 * seek. Isolated paused seeks go through
 * {@link paintSingleFrameAt}, which opens and closes a one-shot
 * decoder per call and spaces consecutive decodes by
 * {@link SINGLE_FRAME_MIN_INTERVAL_MS} so a burst of requests
 * coalesces instead of churning decoders — fine for clicks,
 * ruinous if called per drag tick.
 *
 * Drag-driven seeks must instead bracket their per-tick paints
 * between {@link beginScrubSession} and {@link endScrubSession}
 * and route each tick through {@link paintScrubFrameAt}. That
 * keeps a single decoder warm for the whole drag, so the cost
 * model collapses from "one decoder allocation + GOP decode +
 * teardown per tick" to "one decoder allocation per drag +
 * one decode per kept tick", with stale targets coalesced while
 * the decoder is busy.
 */
export class RafVideoFramePump implements VideoFramePump {

  private currentDecodeTask: AbortController | null = null;
  private currentPaintTeardown: (() => void) | null = null;
  private singleFramePaintInFlight = false;
  private pendingSingleFrameTargetOutputSec: number | null = null;
  private scrubSession: PreviewScrubSession | null = null;
  private scrubConsumerTask: AbortController | null = null;
  private warmingStream = false;
  private pendingRestartOutputSec: number | null = null;

  constructor(
    private readonly track: PreviewVideoTrack,
    private readonly painter: FramePainter,
    private readonly clock: PlaybackClock,
    private readonly readTimeMap: () => RenderTimeMap,
  ) {}

  startFromOutputTime(outputSec: number): void {
    if (this.warmingStream) {
      // A restart is already seeking toward its first frame. Opening another decoder per
      // rapid seek is what churns WebCodecs contexts; keep only the newest target and
      // redirect once the in-flight restart settles.
      this.pendingRestartOutputSec = outputSec;
      if (PUMP_DIAGNOSTICS_ENABLED) {
        console.log(`[Pump] coalesced restart outputSec=${outputSec.toFixed(3)} (stream still warming)`);
      }
      return;
    }
    this.restartStreamAt(outputSec);
  }

  private restartStreamAt(outputSec: number): void {
    const sourceSec = this.readTimeMap().toSourceTime(outputSec);
    if (PUMP_DIAGNOSTICS_ENABLED) {
      console.log(`[Pump] startFromOutputTime outputSec=${outputSec.toFixed(3)} sourceSec=${sourceSec.toFixed(3)}`);
    }
    this.cancel();
    this.warmingStream = true;
    const buffer = new FrameBuffer(PLAYBACK_BUFFER_MAX_FRAMES);
    const diagnostics = PUMP_DIAGNOSTICS_ENABLED ? new RafVideoFramePumpDiagnostics() : null;
    diagnostics?.start();
    const decodeController = new AbortController();
    const paintController = new AbortController();
    this.currentDecodeTask = decodeController;
    this.currentPaintTeardown = (): void => {
      paintController.abort();
      buffer.clear();
      diagnostics?.stop();
    };
    this.runPaintLoop(buffer, paintController.signal, diagnostics);
    void this.runDecodeLoop(sourceSec, buffer, decodeController.signal, diagnostics);
  }

  cancel(): void {
    this.warmingStream = false;
    this.pendingRestartOutputSec = null;
    this.currentDecodeTask?.abort();
    this.currentDecodeTask = null;
    this.currentPaintTeardown?.();
    this.currentPaintTeardown = null;
  }

  async paintSingleFrameAt(outputSec: number): Promise<void> {
    this.pendingSingleFrameTargetOutputSec = outputSec;
    if (this.singleFramePaintInFlight) return;
    this.singleFramePaintInFlight = true;
    try {
      while (this.pendingSingleFrameTargetOutputSec !== null) {
        const target = this.pendingSingleFrameTargetOutputSec;
        this.pendingSingleFrameTargetOutputSec = null;
        await this.decodeAndPaintSingleFrame(target);
        if (this.pendingSingleFrameTargetOutputSec !== null) {
          await this.sleep(SINGLE_FRAME_MIN_INTERVAL_MS);
        }
      }
    } finally {
      this.singleFramePaintInFlight = false;
    }
  }

  private async decodeAndPaintSingleFrame(outputSec: number): Promise<void> {
    const sourceSec = this.readTimeMap().toSourceTime(outputSec);
    const frame = await this.track.getFrameAt(sourceSec);
    if (!frame) return;
    try {
      if (this.pendingSingleFrameTargetOutputSec === null) this.painter.paint(frame);
    } finally {
      frame.close();
    }
  }

  beginScrubSession(): void {
    if (this.scrubSession) return;
    const session = this.track.openScrubSession();
    const controller = new AbortController();
    this.scrubSession = session;
    this.scrubConsumerTask = controller;
    void this.consumeScrubFrames(session, controller.signal);
  }

  paintScrubFrameAt(outputSec: number): void {
    if (!this.scrubSession) return;
    const sourceSec = this.readTimeMap().toSourceTime(outputSec);
    this.scrubSession.scrubTo(sourceSec);
  }

  endScrubSession(): void {
    const session = this.scrubSession;
    const controller = this.scrubConsumerTask;
    this.scrubSession = null;
    this.scrubConsumerTask = null;
    if (!session) return;
    session.close();
    controller?.abort();
  }

  private async consumeScrubFrames(session: PreviewScrubSession, signal: AbortSignal): Promise<void> {
    try {
      for await (const frame of session.frames()) {
        if (signal.aborted) { frame.close(); return; }
        try {
          this.painter.paint(frame);
        } finally {
          frame.close();
        }
      }
    } catch {
      // The track throws on a disposed source; the session is being torn down anyway.
    }
  }

  private async runDecodeLoop(
    startSourceSec: number,
    buffer: FrameBuffer,
    signal: AbortSignal,
    diagnostics: RafVideoFramePumpDiagnostics | null,
  ): Promise<void> {
    let iterator = this.openIteratorAt(startSourceSec);
    let leakageBoundarySec = startSourceSec;
    let lastYieldedSourceSec = startSourceSec;
    let warmupSettled = false;
    try {
      while (!signal.aborted) {
        if (buffer.isFull()) {
          await this.waitForBufferRoom(signal);
          continue;
        }
        const pullStart = performance.now();
        const next = await iterator.next();
        diagnostics?.recordIteratorYield(performance.now() - pullStart);
        if (next.done) return;
        const sourceFrame = next.value;
        lastYieldedSourceSec = sourceFrame.timestampSec;
        if (signal.aborted) { sourceFrame.close(); return; }
        if (!warmupSettled) {
          warmupSettled = true;
          if (this.redirectToPendingRestartIfAny(signal)) { sourceFrame.close(); return; }
        }
        if (sourceFrame.timestampSec < leakageBoundarySec) { sourceFrame.close(); continue; }

        const cut = this.readTimeMap().findContainingRange(sourceFrame.timestampSec);
        if (cut) {
          sourceFrame.close();
          diagnostics?.recordInCutDrop();
          if (this.isLongCut(cut)) {
            iterator = await this.swapIteratorTo(iterator, cut.endSec);
            leakageBoundarySec = cut.endSec;
            diagnostics?.recordLongCutSwap();
          }
          continue;
        }

        const outputTimeSec = this.readTimeMap().toOutputTime(sourceFrame.timestampSec);
        const runawayClockOutputSec = this.detectClockRunaway(outputTimeSec);
        if (runawayClockOutputSec !== null) {
          sourceFrame.close();
          const restartSourceSec = this.readTimeMap().toSourceTime(runawayClockOutputSec);
          console.log(
            `[Pump] clock ran ${(runawayClockOutputSec - outputTimeSec).toFixed(1)}s ahead of decode`
            + ` — restarting stream at outputSec=${runawayClockOutputSec.toFixed(3)}`,
          );
          iterator = await this.swapIteratorTo(iterator, restartSourceSec);
          leakageBoundarySec = restartSourceSec;
          continue;
        }

        buffer.push(sourceFrame, outputTimeSec);
        diagnostics?.recordFramePushed(buffer.size());
      }
    } catch (err) {
      // A cancelled run may still see its source torn down mid-pull; only an un-cancelled crash is news.
      if (!signal.aborted) {
        console.error(
          `[Pump] decode loop crashed`
          + ` lastYieldedSourceSec=${lastYieldedSourceSec.toFixed(3)}`
          + ` bufferSize=${buffer.size()}`,
          err,
        );
      }
    } finally {
      await iterator.return?.();
      if (!warmupSettled) this.redirectToPendingRestartIfAny(signal);
    }
  }

  /**
   * Ends the warm-up of the current run and, when a coalesced seek
   * target is waiting, restarts the stream there. Returns true when
   * the redirect happened — the running decode loop must stop, its
   * frames were aimed at a stale target.
   */
  private redirectToPendingRestartIfAny(signal: AbortSignal): boolean {
    if (signal.aborted) return false;
    this.warmingStream = false;
    const pending = this.pendingRestartOutputSec;
    this.pendingRestartOutputSec = null;
    if (pending === null) return false;
    if (PUMP_DIAGNOSTICS_ENABLED) {
      console.log(`[Pump] redirecting to coalesced target outputSec=${pending.toFixed(3)}`);
    }
    this.restartStreamAt(pending);
    return true;
  }

  private detectClockRunaway(frameOutputSec: number): number | null {
    if (!this.clock.isRunning()) return null;
    const clockOutputSec = this.clock.currentOutputTimeSec();
    if (frameOutputSec + CLOCK_RUNAWAY_RESTART_THRESHOLD_SEC > clockOutputSec) return null;
    return clockOutputSec;
  }

  private runPaintLoop(
    buffer: FrameBuffer,
    signal: AbortSignal,
    diagnostics: RafVideoFramePumpDiagnostics | null,
  ): void {
    const tick = (): void => {
      if (signal.aborted) return;
      const target = this.clock.currentOutputTimeSec();
      diagnostics?.recordClockTarget(target);
      const frame = buffer.takeLatestUpTo(target);
      diagnostics?.recordRafTick(buffer.size(), frame !== null);
      diagnostics?.recordBufferOutputTimeRange(buffer.headOutputTimeSec(), buffer.tailOutputTimeSec());
      if (frame) this.paintAndCloseFrame(frame, diagnostics);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private paintAndCloseFrame(
    frame: PreviewVideoFrame,
    diagnostics: RafVideoFramePumpDiagnostics | null,
  ): void {
    const paintStart = performance.now();
    try {
      this.painter.paint(frame);
    } finally {
      frame.close();
      diagnostics?.recordFramePainted(performance.now() - paintStart);
    }
  }

  private waitForBufferRoom(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) { resolve(); return; }
      const onAbort = (): void => {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, BUFFER_FULL_BACKOFF_MS);
      signal.addEventListener('abort', onAbort);
    });
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  private openIteratorAt(sourceSec: number): AsyncIterator<PreviewVideoFrame> {
    return this.track.streamFrames(sourceSec)[Symbol.asyncIterator]();
  }

  private async swapIteratorTo(
    current: AsyncIterator<PreviewVideoFrame>,
    sourceSec: number,
  ): Promise<AsyncIterator<PreviewVideoFrame>> {
    await current.return?.();
    return this.openIteratorAt(sourceSec);
  }

  private isLongCut(cut: CutRange): boolean {
    return cut.endSec - cut.startSec >= LONG_CUT_SKIP_THRESHOLD_SEC;
  }
}
