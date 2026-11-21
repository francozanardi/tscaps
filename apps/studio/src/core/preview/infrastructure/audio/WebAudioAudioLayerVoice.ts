import { type AudioLayer } from '@tscaps/engine';
import { AudioGainEnvelope } from '@tscaps/engine/advanced';
import type { AudioScheduleClock } from '@core/preview/domain/AudioScheduleClock';
import type { PreviewAudioSource } from '@core/preview/domain/PreviewAudioSource';

/** Where a voice plays and what it plays from. */
export interface AudioLayerVoiceSetup {
  readonly context: BaseAudioContext;
  readonly output: AudioNode;
  readonly clock: AudioScheduleClock;
  /** Null when the layer's file cannot be opened: the voice stays silent. */
  readonly source: Promise<PreviewAudioSource | null>;
  readonly outputDurationSec: number;
  /** How far ahead of the clock sound is scheduled, in seconds of the audio context. */
  readonly lookAheadSec: number;
}

/**
 * One audio layer playing, from a moment of the output on, through a
 * gain of its own that follows the layer's {@link AudioGainEnvelope}:
 * the breakpoints set as linear ramps, which is the curve the export
 * applies. Each pass of the layer's file is read a chunk at a time and
 * every chunk scheduled where it lands on the clock, no further ahead
 * than the look-ahead; a chunk whose moment has already passed plays
 * from where the clock is. Runs until stopped, the layer ends, or the
 * clock stops being followed.
 */
export class WebAudioAudioLayerVoice {
  private static readonly SHORTEST_CHUNK_SEC = 0.001;
  private static readonly SHORTEST_WAIT_MS = 20;
  private static readonly LONGEST_WAIT_MS = 250;

  private readonly gain: GainNode;
  private readonly scheduled = new Set<AudioBufferSourceNode>();
  private readonly task = new AbortController();
  private opened: PreviewAudioSource | null = null;

  constructor(
    private layer: AudioLayer,
    private readonly setup: AudioLayerVoiceSetup,
  ) {
    this.gain = setup.context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(setup.output);
  }

  /** Starts playing from `outputSec` on, once the layer's file is open. */
  start(outputSec: number): void {
    void this.run(outputSec).catch((error: unknown) => {
      if (!this.task.signal.aborted) console.error(`[audio-preview] the layer ${this.layer.id} stopped playing`, error);
    });
  }

  /** Whether `layer` plays what this voice plays, at the same moments: only its level may differ. */
  playsAs(layer: AudioLayer): boolean {
    return layer.source === this.layer.source
      && layer.outputStartSec === this.layer.outputStartSec
      && layer.outputEndSec === this.layer.outputEndSec
      && layer.sourceStartSec === this.layer.sourceStartSec
      && layer.sourcePassSec === this.layer.sourcePassSec;
  }

  /** Takes the level of `layer`, which {@link playsAs} this voice, from the clock's moment on. */
  reshape(layer: AudioLayer): void {
    this.layer = layer;
    if (this.opened === null) return;
    const envelope = this.envelopeOf(this.opened);
    const fromSec = this.notBeforeNow(envelope.startSec);
    if (fromSec < envelope.endSec) this.scheduleEnvelope(envelope, fromSec);
  }

  /** Silences the voice for good. */
  stop(): void {
    this.task.abort();
    for (const node of this.scheduled) this.release(node);
    this.scheduled.clear();
    this.gain.disconnect();
  }

  private async run(outputSec: number): Promise<void> {
    const source = await this.setup.source;
    if (source === null || this.task.signal.aborted) return;
    this.opened = source;
    const envelope = this.envelopeOf(source);
    const fromSec = this.notBeforeNow(Math.max(outputSec, envelope.startSec));
    if (fromSec >= envelope.endSec) return;
    this.scheduleEnvelope(envelope, fromSec);
    await this.playPassesFrom(source, envelope, fromSec);
  }

  private envelopeOf(source: PreviewAudioSource): AudioGainEnvelope {
    return new AudioGainEnvelope(this.layer, {
      outputDurationSec: this.setup.outputDurationSec,
      sourceDurationSec: source.durationSec,
    });
  }

  /** `outputSec`, or the clock's moment if that is later: opening a file takes time while the clock runs. */
  private notBeforeNow(outputSec: number): number {
    const clock = this.setup.clock;
    return clock.isRunning() ? Math.max(outputSec, clock.currentOutputTimeSec()) : outputSec;
  }

  /** Sets the gain to the envelope from `fromSec` on, replacing whatever was set from now. */
  private scheduleEnvelope(envelope: AudioGainEnvelope, fromSec: number): void {
    const param = this.gain.gain;
    const now = this.setup.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(envelope.gainAt(fromSec), Math.max(now, this.contextTimeOf(fromSec)));
    let previousSec = fromSec;
    for (const point of envelope.breakpoints) {
      if (point.timeSec <= fromSec) continue;
      if (!Number.isFinite(point.timeSec)) break;
      const at = this.contextTimeOf(point.timeSec);
      // Two breakpoints at one moment are a step, not a ramp.
      if (point.timeSec === previousSec) param.setValueAtTime(point.gain, at);
      else param.linearRampToValueAtTime(point.gain, at);
      previousSec = point.timeSec;
    }
  }

  private async playPassesFrom(source: PreviewAudioSource, envelope: AudioGainEnvelope, fromSec: number): Promise<void> {
    const passSec = this.passLength();
    let passStartSec = Number.isFinite(passSec)
      ? envelope.startSec + Math.floor((fromSec - envelope.startSec) / passSec) * passSec
      : envelope.startSec;
    let playFromSec = fromSec;
    while (passStartSec < envelope.endSec && !this.task.signal.aborted) {
      const passEndSec = Math.min(envelope.endSec, passStartSec + passSec);
      await this.playPass(source, passStartSec, playFromSec, passEndSec);
      passStartSec += passSec;
      playFromSec = passStartSec;
    }
  }

  /** How long one pass of the file runs before it starts over; `Infinity` for a layer that plays once. */
  private passLength(): number {
    const passSec = this.layer.sourcePassSec;
    return Number.isFinite(passSec) && passSec > 0 ? passSec : Number.POSITIVE_INFINITY;
  }

  /** Plays the pass starting at `passStartSec`, from `fromSec` until `passEndSec`, or until its file runs out. */
  private async playPass(source: PreviewAudioSource, passStartSec: number, fromSec: number, passEndSec: number): Promise<void> {
    await this.untilDue(fromSec);
    if (this.task.signal.aborted) return;
    const sourceStartSec = this.layer.sourceStartSec;
    const sourceFromSec = sourceStartSec + (fromSec - passStartSec);
    const sourceUntilSec = sourceStartSec + (passEndSec - passStartSec);
    const chunks = source.chunksFrom(sourceFromSec)[Symbol.asyncIterator]();
    try {
      while (!this.task.signal.aborted) {
        const next = await chunks.next();
        if (next.done || this.task.signal.aborted) return;
        const { buffer, timestampSec } = next.value;
        const chunkEndSec = timestampSec + buffer.duration;
        if (chunkEndSec <= sourceFromSec) continue;
        if (timestampSec >= sourceUntilSec) return;
        const playFromSec = Math.max(timestampSec, sourceFromSec);
        const playToSec = Math.min(chunkEndSec, sourceUntilSec);
        this.schedule(buffer, playFromSec - timestampSec, playToSec - playFromSec, passStartSec + (playFromSec - sourceStartSec));
        await this.untilDue(passStartSec + (playToSec - sourceStartSec));
      }
    } finally {
      await chunks.return?.();
    }
  }

  /**
   * Plays `durationSec` of `buffer` from `offsetSec` at `atOutputSec`,
   * or the part of it still ahead of the audio context's time when that
   * moment has passed.
   */
  private schedule(buffer: AudioBuffer, offsetSec: number, durationSec: number, atOutputSec: number): void {
    const context = this.setup.context;
    const rate = this.setup.clock.getRate();
    const now = context.currentTime;
    const at = this.contextTimeOf(atOutputSec);
    const lateSec = Math.max(0, now - at) * rate;
    const playableSec = durationSec - lateSec;
    if (playableSec < WebAudioAudioLayerVoice.SHORTEST_CHUNK_SEC) return;
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = rate;
    node.connect(this.gain);
    node.onended = () => {
      this.scheduled.delete(node);
      node.disconnect();
    };
    node.start(Math.max(now, at), offsetSec + lateSec, playableSec);
    this.scheduled.add(node);
  }

  /** Resolves once `outputSec` is within the look-ahead of the audio context's time, or the voice stops. */
  private async untilDue(outputSec: number): Promise<void> {
    const signal = this.task.signal;
    while (!signal.aborted) {
      const aheadSec = this.contextTimeOf(outputSec) - this.setup.context.currentTime - this.setup.lookAheadSec;
      if (aheadSec <= 0) return;
      const waitMs = Math.min(
        WebAudioAudioLayerVoice.LONGEST_WAIT_MS,
        Math.max(WebAudioAudioLayerVoice.SHORTEST_WAIT_MS, aheadSec * 1000),
      );
      await this.sleep(waitMs, signal);
    }
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      signal.addEventListener('abort', finish, { once: true });
    });
  }

  private contextTimeOf(outputSec: number): number {
    return this.setup.clock.audioContextTimeForOutputTime(outputSec);
  }

  private release(node: AudioBufferSourceNode): void {
    node.onended = null;
    try {
      node.stop();
    } catch {
      // Stopping a node that already ended throws in some engines; it is silent either way.
    }
    node.disconnect();
  }
}
