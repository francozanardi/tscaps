import type { AudioDuck, AudioLayer, RenderAudioMix } from '@tscaps/engine';
import type { AudioMixLayer, AudioMixLayerDuck, ResolvedAudioMix } from '@core/audio-mix/domain/AudioMixLayer';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/** A resolved mix with its files read, and the files that could not be. */
export interface RenderAudioMixBuild {
  /** The engine's mix: every layer whose file could be had, in the order resolved. May hold no layer. */
  readonly mix: RenderAudioMix;
  /** The files some layer names that could not be had, each once, in the order first named. */
  readonly unavailable: ReadonlyArray<AudioSourceRef>;
}

/**
 * Turns a resolved mix into the engine's: each layer kept field for
 * field, with the file it names read through `files`. Every file is read
 * once however many layers play it, and all of them at once, so the
 * same `Blob` backs every layer playing one file.
 *
 * A layer whose file cannot be had is left out, and the file named.
 * The video's own level, and where a shot changes it, are carried as
 * they are, layers or not.
 */
export class RenderAudioMixBuilder {

  /**
   * Waits for every file, until `signal` aborts, when it stops waiting
   * and rejects with the signal's reason. The reads themselves go on.
   */
  async build(resolved: ResolvedAudioMix, files: AudioSourceFiles, signal: AbortSignal): Promise<RenderAudioMixBuild> {
    signal.throwIfAborted();
    const reads = this.readEachFileOnce(resolved.layers, files);
    const layers: AudioLayer[] = [];
    const unavailable = new Map<string, AudioSourceRef>();
    for (const layer of resolved.layers) {
      const key = this.keyOf(layer.source);
      const file = await this.untilAborted(reads.get(key)!, signal);
      if (file === null) unavailable.set(key, layer.source);
      else layers.push(this.engineLayerOf(layer, file));
    }
    return {
      mix: { layers, inputGain: resolved.inputGain, inputDucks: resolved.inputDucks.map((duck) => this.engineDuckOf(duck)) },
      unavailable: [...unavailable.values()],
    };
  }

  private readEachFileOnce(
    layers: ReadonlyArray<AudioMixLayer>,
    files: AudioSourceFiles,
  ): ReadonlyMap<string, Promise<Blob | null>> {
    const reads = new Map<string, Promise<Blob | null>>();
    for (const layer of layers) {
      const key = this.keyOf(layer.source);
      if (!reads.has(key)) reads.set(key, files.load(layer.source));
    }
    return reads;
  }

  private keyOf(source: AudioSourceRef): string {
    return source.kind === 'media' ? `media:${source.mediaId}` : `builtin:${source.soundId}`;
  }

  private engineLayerOf(layer: AudioMixLayer, source: Blob): AudioLayer {
    return {
      id: layer.id,
      source,
      outputStartSec: layer.outputStartSec,
      outputEndSec: layer.outputEndSec,
      sourceStartSec: layer.sourceStartSec,
      sourcePassSec: layer.sourcePassSec,
      gain: layer.gain,
      fadeInSec: layer.fadeInSec,
      fadeOutSec: layer.fadeOutSec,
      duck: layer.duck === null ? null : this.engineDuckOf(layer.duck),
    };
  }

  private engineDuckOf(duck: AudioMixLayerDuck): AudioDuck {
    return {
      ranges: duck.ranges.map((range) => ({ startSec: range.startSec, endSec: range.endSec })),
      gain: duck.gain,
      attackSec: duck.attackSec,
      releaseSec: duck.releaseSec,
    };
  }

  private untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }
}
