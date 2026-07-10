import type { RenderTimeMap } from '@tscaps/engine';
import type { AudioSamplePump } from '@core/preview/domain/AudioSamplePump';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';
import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';
import type { PlaybackClock } from '@core/preview/domain/PlaybackClock';

const SCHEDULE_AHEAD_SEC = 1.0;
const SCHEDULE_BACKOFF_MS = 50;
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
 */
export class WebAudioAudioSamplePump implements AudioSamplePump {

  private currentTask: AbortController | null = null;
  private scheduledNodes: AudioBufferSourceNode[] = [];
  private lastScheduledAudioContextSec: number | null = null;
  private previousPumpDrain: Promise<void> = Promise.resolve();

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
    const startSourceSec = this.readTimeMap().toSourceTime(fromOutputSec);
    const iterator = this.track.streamFrames(startSourceSec)[Symbol.asyncIterator]();
    try {
      while (!signal.aborted) {
        if (this.isScheduledFarEnoughAhead()) {
          await this.sleepUntilQueueDrains(signal);
          continue;
        }
        const next = await iterator.next();
        if (next.done) return;
        const frame = next.value;
        if (signal.aborted) { frame.close(); return; }
        this.scheduleFrameIfFresh(frame);
      }
    } finally {
      await iterator.return?.();
    }
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

  private scheduleFrameIfFresh(frame: PreviewAudioFrame): void {
    try {
      const map = this.readTimeMap();
      if (map.findContainingRange(frame.timestampSec)) return;
      const outputSec = map.toOutputTime(frame.timestampSec);
      const audioContextSec = this.clock.audioContextTimeForOutputTime(outputSec);
      if (audioContextSec < this.audioContext.currentTime) return;
      this.scheduleFrame(frame, audioContextSec);
    } finally {
      frame.close();
    }
  }

  private scheduleFrame(frame: PreviewAudioFrame, audioContextSec: number): void {
    const buffer = frame.toAudioBuffer();
    const node = this.audioContext.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = this.clock.getRate();
    node.connect(this.outputNode);
    node.start(audioContextSec);
    this.scheduledNodes.push(node);
    const endsAtSec = audioContextSec + buffer.duration;
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
