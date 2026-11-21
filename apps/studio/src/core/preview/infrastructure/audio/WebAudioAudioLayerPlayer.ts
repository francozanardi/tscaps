import type { AudioDuck, AudioLayer } from '@tscaps/engine';
import type { AudioScheduleClock } from '@core/preview/domain/AudioScheduleClock';
import type { PreviewAudioLayerPlayer } from '@core/preview/domain/PreviewAudioLayerPlayer';
import type { PreviewAudioSource } from '@core/preview/domain/PreviewAudioSource';
import type { PreviewAudioSourceOpener } from '@core/preview/domain/PreviewAudioSourceOpener';
import { WebAudioAudioLayerVoice } from '@core/preview/infrastructure/audio/WebAudioAudioLayerVoice';
import type { WebAudioInputLevel } from '@core/preview/infrastructure/audio/WebAudioInputLevel';

/** The graph a player plays into while mounted. */
interface MountedGraph {
  readonly context: AudioContext;
  readonly output: AudioNode;
  readonly clock: AudioScheduleClock;
}

/**
 * {@link PreviewAudioLayerPlayer} on Web Audio: one
 * {@link WebAudioAudioLayerVoice} per layer while playing, each with a
 * gain of its own into the host's output.
 *
 * Files are opened through `opener` as soon as a layer names them,
 * keyed by the `Blob` itself, so a file handed over again as the same
 * object is never opened twice. A file that cannot be opened is
 * reported once and its layers stay silent. The host's own level is
 * driven by `inputLevel`, which follows the clock whenever the layers do.
 */
export class WebAudioAudioLayerPlayer implements PreviewAudioLayerPlayer {
  private mounted: MountedGraph | null = null;
  private layers: ReadonlyArray<AudioLayer> = [];
  private outputDurationSec = Number.POSITIVE_INFINITY;
  private readonly sources = new Map<Blob, Promise<PreviewAudioSource | null>>();
  private voices = new Map<string, WebAudioAudioLayerVoice>();
  private playing = false;
  private inputGain = 1;
  private inputDucks: ReadonlyArray<AudioDuck> = [];

  /**
   * @param lookAheadSec - How far ahead of the clock sound is scheduled,
   * in seconds of the audio context.
   */
  constructor(
    private readonly opener: PreviewAudioSourceOpener,
    private readonly lookAheadSec: number,
    private readonly inputLevel: WebAudioInputLevel,
  ) {}

  mount(context: AudioContext, output: AudioNode, clock: AudioScheduleClock, inputLevel: AudioParam): void {
    this.stop();
    this.mounted = { context, output, clock };
    this.inputLevel.mount(context, inputLevel, clock);
    this.openFilesInUse();
  }

  unmount(): void {
    this.stop();
    this.mounted = null;
    this.inputLevel.unmount();
    this.releaseFilesExcept(new Set());
  }

  setLayers(layers: ReadonlyArray<AudioLayer>, outputDurationSec: number): void {
    const lengthChanged = outputDurationSec !== this.outputDurationSec;
    this.layers = layers;
    this.outputDurationSec = outputDurationSec;
    if (lengthChanged) this.inputLevel.set(this.inputGain, this.inputDucks, outputDurationSec);
    this.openFilesInUse();
    if (this.playing) this.replan(lengthChanged);
    this.releaseFilesExcept(this.filesInUse());
  }

  setInputLevel(gain: number, ducks: ReadonlyArray<AudioDuck>): void {
    this.inputGain = gain;
    this.inputDucks = ducks;
    this.inputLevel.set(gain, ducks, this.outputDurationSec);
  }

  playFrom(outputSec: number): void {
    this.silenceVoices();
    const mounted = this.mounted;
    this.playing = mounted !== null;
    if (mounted === null) return;
    this.inputLevel.followFrom(outputSec);
    for (const layer of this.layers) this.voices.set(layer.id, this.startVoice(mounted, layer, outputSec));
  }

  stop(): void {
    this.playing = false;
    this.inputLevel.stop();
    this.silenceVoices();
  }

  /** Brings the voices in line with the layers from the clock's moment on, keeping each that only changed level. */
  private replan(lengthChanged: boolean): void {
    const mounted = this.mounted;
    if (mounted === null) return;
    const fromSec = mounted.clock.currentOutputTimeSec();
    const previous = this.voices;
    this.voices = new Map();
    for (const layer of this.layers) {
      const kept = previous.get(layer.id);
      if (kept !== undefined && !lengthChanged && kept.playsAs(layer)) {
        kept.reshape(layer);
        previous.delete(layer.id);
        this.voices.set(layer.id, kept);
      } else {
        this.voices.set(layer.id, this.startVoice(mounted, layer, fromSec));
      }
    }
    for (const leftover of previous.values()) leftover.stop();
  }

  private startVoice(mounted: MountedGraph, layer: AudioLayer, fromSec: number): WebAudioAudioLayerVoice {
    const voice = new WebAudioAudioLayerVoice(layer, {
      context: mounted.context,
      output: mounted.output,
      clock: mounted.clock,
      source: this.sources.get(layer.source) ?? Promise.resolve(null),
      outputDurationSec: this.outputDurationSec,
      lookAheadSec: this.lookAheadSec,
    });
    voice.start(fromSec);
    return voice;
  }

  private silenceVoices(): void {
    for (const voice of this.voices.values()) voice.stop();
    this.voices.clear();
  }

  private filesInUse(): Set<Blob> {
    return new Set(this.layers.map((layer) => layer.source));
  }

  private openFilesInUse(): void {
    const mounted = this.mounted;
    if (mounted === null) return;
    for (const file of this.filesInUse()) {
      if (!this.sources.has(file)) this.sources.set(file, this.open(file, mounted.context.sampleRate));
    }
  }

  private async open(file: Blob, sampleRate: number): Promise<PreviewAudioSource | null> {
    try {
      return await this.opener.open(file, sampleRate);
    } catch (error) {
      console.warn('[audio-preview] a sound file could not be opened; its layers stay silent', error);
      return null;
    }
  }

  private releaseFilesExcept(kept: ReadonlySet<Blob>): void {
    for (const [file, source] of this.sources) {
      if (kept.has(file)) continue;
      this.sources.delete(file);
      void source.then((opened) => opened?.dispose());
    }
  }
}
