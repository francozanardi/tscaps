import type { RenderTimeMap } from '@tscaps/engine';
import type { AudioSamplePump } from '@core/preview/domain/AudioSamplePump';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';
import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';
import type { PlaybackClock } from '@core/preview/domain/PlaybackClock';

const SCHEDULE_AHEAD_SEC = 1.0;
const SCHEDULE_BACKOFF_MS = 50;
/** The least time the track is reopened ahead of the clock after falling behind it. */
const SHORTEST_CATCH_UP_LEAD_SEC = 0.1;
/** How many times the track's last measured opening delay it is reopened ahead of the clock. */
const CATCH_UP_LEAD_PER_OPENING_DELAY = 1.5;
const AUDIO_PUMP_DIAGNOSTICS_ENABLED = false;

/**
 * {@link AudioSamplePump} implementation that schedules each
 * decoded frame on a Web Audio {@link AudioBufferSourceNode}
 * timed against the underlying audio rendering clock.
 *
 * The pump only stays {@link SCHEDULE_AHEAD_SEC} seconds ahead
 * of the audio renderer's wall position. Without that ceiling
 * the pump would drain the source's audio track in one burst
 * and pin thousands of source nodes onto the graph, which
 * starves the audio thread enough that `audioContext.currentTime`
 * stops tracking wall-clock — and the shared {@link PlaybackClock}
 * stalls with it.
 *
 * Frames that fall inside a cut range are silently dropped — the
 * cuts effectively produce silence in the output timeline.
 *
 * Decoding can fall behind the clock: the first frames of a stream take
 * a while to come out, and a busy main thread holds decoding up. A frame
 * partly in the past plays from the present on. Once one comes out
 * wholly in the past, the pump reopens the track at the clock's
 * position plus a lead, sized from how long the track took to start
 * yielding last time, instead of decoding through the backlog: on a
 * device that decodes only a little faster than real time, that backlog
 * takes seconds to clear, all of them silent.
 */
export class WebAudioAudioSamplePump implements AudioSamplePump {

  private currentTask: AbortController | null = null;
  private scheduledNodes: AudioBufferSourceNode[] = [];
  private lastScheduledAudioContextSec: number | null = null;
  private previousPumpDrain: Promise<void> = Promise.resolve();
  /** How long the track last took to yield its first frame after being opened. */
  private openingDelaySec = 0;

  constructor(
    private readonly track: PreviewAudioTrack,
    private readonly audioContext: AudioContext,
    private readonly outputNode: AudioNode,
    private readonly clock: PlaybackClock,
    private readonly readTimeMap: () => RenderTimeMap,
  ) {}

  startFromOutputTime(outputSec: number): void {
    if (AUDIO_PUMP_DIAGNOSTICS_ENABLED) {
      console.log(`[AudioPump] startFromOutputTime outputSec=${outputSec.toFixed(3)} scheduledNodes=${this.scheduledNodes.length}`);
    }
    this.cancel();
    const controller = new AbortController();
    this.currentTask = controller;
    const previousDrain = this.previousPumpDrain;
    this.previousPumpDrain = this.runPumpAfterPreviousDrained(previousDrain, outputSec, controller.signal);
  }

  private async runPumpAfterPreviousDrained(
    previousDrain: Promise<void>,
    fromOutputSec: number,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await previousDrain;
    } catch {
      // Previous run already reported its own crash; the chain continues so later restarts stay serialized.
    }
    if (signal.aborted) return;
    try {
      await this.runPump(fromOutputSec, signal);
    } catch {
      // runPump only throws on unrecoverable errors; swallow so the drain chain stays alive for the next restart.
    }
  }

  cancel(): void {
    this.currentTask?.abort();
    this.currentTask = null;
    this.stopAllScheduledNodes();
    this.lastScheduledAudioContextSec = null;
  }

  async primeFirstFrame(): Promise<void> {
    const iterator = this.track.streamFrames(0)[Symbol.asyncIterator]();
    try {
      const next = await iterator.next();
      if (!next.done) next.value.close();
    } finally {
      await iterator.return?.();
    }
  }

  private async runPump(fromOutputSec: number, signal: AbortSignal): Promise<void> {
    let streamFromOutputSec = fromOutputSec;
    while (!signal.aborted) {
      const fellBehind = await this.streamFrom(streamFromOutputSec, signal);
      if (!fellBehind) return;
      streamFromOutputSec = this.clock.currentOutputTimeSec() + this.catchUpLeadSec();
    }
  }

  /**
   * Schedules the track's frames from `fromOutputSec` on. Answers `true`
   * when a frame came out wholly in the past, so the stream is behind
   * the clock; `false` when the track ended or the run was cancelled.
   */
  private async streamFrom(fromOutputSec: number, signal: AbortSignal): Promise<boolean> {
    const startSourceSec = this.readTimeMap().toSourceTime(fromOutputSec);
    const openedAtMs = performance.now();
    let yielded = false;
    const iterator = this.track.streamFrames(startSourceSec)[Symbol.asyncIterator]();
    try {
      while (!signal.aborted) {
        if (this.isScheduledFarEnoughAhead()) {
          await this.sleepUntilQueueDrains(signal);
          continue;
        }
        const next = await iterator.next();
        if (next.done) return false;
        const frame = next.value;
        if (!yielded) {
          yielded = true;
          this.openingDelaySec = (performance.now() - openedAtMs) / 1000;
        }
        if (signal.aborted) { frame.close(); return false; }
        if (this.scheduleFrameIfFresh(frame) === 'behind') return true;
      }
      return false;
    } finally {
      await iterator.return?.();
    }
  }

  private catchUpLeadSec(): number {
    const lead = this.openingDelaySec * CATCH_UP_LEAD_PER_OPENING_DELAY;
    return Math.min(SCHEDULE_AHEAD_SEC, Math.max(SHORTEST_CATCH_UP_LEAD_SEC, lead));
  }

  private isScheduledFarEnoughAhead(): boolean {
    if (this.lastScheduledAudioContextSec === null) return false;
    return this.lastScheduledAudioContextSec - this.audioContext.currentTime >= SCHEDULE_AHEAD_SEC;
  }

  private sleepUntilQueueDrains(signal: AbortSignal): Promise<void> {
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
      }, SCHEDULE_BACKOFF_MS);
      signal.addEventListener('abort', onAbort);
    });
  }

  /**
   * Schedules what is still ahead of the audio clock of `frame`, and
   * closes it. Answers `behind` when none of it is.
   */
  private scheduleFrameIfFresh(frame: PreviewAudioFrame): 'scheduled' | 'skipped' | 'behind' {
    try {
      const map = this.readTimeMap();
      if (map.findContainingRange(frame.timestampSec)) return 'skipped';
      const outputSec = map.toOutputTime(frame.timestampSec);
      const audioContextSec = this.clock.audioContextTimeForOutputTime(outputSec);
      const buffer = frame.toAudioBuffer();
      const rate = this.clock.getRate();
      const lateSec = Math.max(0, this.audioContext.currentTime - audioContextSec);
      if (lateSec * rate >= buffer.duration) return 'behind';
      this.scheduleBuffer(buffer, audioContextSec + lateSec, lateSec * rate);
      return 'scheduled';
    } finally {
      frame.close();
    }
  }

  /** Plays `buffer` from `offsetSec` into it, at `audioContextSec`. */
  private scheduleBuffer(buffer: AudioBuffer, audioContextSec: number, offsetSec: number): void {
    const rate = this.clock.getRate();
    const node = this.audioContext.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = rate;
    node.connect(this.outputNode);
    node.start(audioContextSec, offsetSec);
    this.scheduledNodes.push(node);
    const endsAtSec = audioContextSec + (buffer.duration - offsetSec) / rate;
    if (this.lastScheduledAudioContextSec === null
        || endsAtSec > this.lastScheduledAudioContextSec) {
      this.lastScheduledAudioContextSec = endsAtSec;
    }
    node.onended = (): void => {
      this.removeScheduledNode(node);
    };
  }

  private removeScheduledNode(node: AudioBufferSourceNode): void {
    const index = this.scheduledNodes.indexOf(node);
    if (index !== -1) this.scheduledNodes.splice(index, 1);
    try { node.disconnect(); } catch { /* already disconnected */ }
  }

  private stopAllScheduledNodes(): void {
    for (const node of this.scheduledNodes) {
      try { node.stop(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.scheduledNodes = [];
  }
}
