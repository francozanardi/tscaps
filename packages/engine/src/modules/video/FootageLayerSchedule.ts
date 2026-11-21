import type { FootageLayer } from '@modules/video/FootageLayer';

/**
 * One pass of a layer: the output stretch over which its video runs
 * straight from `layer.sourceStartSec`, before starting over. Any other
 * layer is a single pass over its whole stretch — a GIF loops
 * by its own length, inside the pass.
 */
export interface FootagePass {
  readonly layer: FootageLayer;
  readonly outputStartSec: number;
  readonly outputEndSec: number;
}

/**
 * Answers, for a point of the output, which layers are drawn there, in
 * which order, and which moment of each layer's video belongs there.
 *
 * Layers keep the order they are given in, which is the order they are
 * drawn in, bottom to top. A layer covering nothing — an empty stretch,
 * or a video whose pass is not positive — is left out.
 */
export class FootageLayerSchedule {
  private readonly layers: readonly FootageLayer[];

  constructor(layers: ReadonlyArray<FootageLayer>) {
    this.layers = layers.filter((layer) => layer.outputEndSec > layer.outputStartSec && this.passSecOf(layer) > 0);
  }

  /** The layers covering `outputSec`, bottom to top; empty where the source's own picture shows alone. */
  layersAt(outputSec: number): FootageLayer[] {
    return this.layers.filter((layer) => this.covers(layer, outputSec));
  }

  /**
   * The moment of `layer`'s footage shown at `outputSec`, which `layer`
   * covers. An image, the source's own picture and the backdrop have no
   * moments of their own; `sourceStartSec` is answered. A GIF's moment runs on from `sourceStartSec` without starting over;
   * where it loops is the GIF's own timeline's to answer. Provided
   * pictures' moments run on the same way, and never start over.
   */
  sourceTimeAt(layer: FootageLayer, outputSec: number): number {
    if (layer.source.kind === 'image' || layer.source.kind === 'source-picture' || layer.source.kind === 'backdrop') {
      return layer.sourceStartSec;
    }
    if (layer.source.kind === 'gif' || layer.source.kind === 'provided') return layer.sourceStartSec + (outputSec - layer.outputStartSec);
    return layer.sourceStartSec + ((outputSec - layer.outputStartSec) % layer.sourcePassSec);
  }

  /** The pass of each layer covering `outputSec`, bottom to top. */
  passesAt(outputSec: number): FootagePass[] {
    return this.layersAt(outputSec).map((layer) => this.passOf(layer, this.passIndexAt(layer, outputSec)));
  }

  /**
   * The first pass to start strictly after `outputSec`, of any layer —
   * including the next pass of a layer that starts over — or null when
   * none starts from there on. Of two starting together, the lower layer.
   */
  nextPassAfter(outputSec: number): FootagePass | null {
    let next: FootagePass | null = null;
    for (const layer of this.layers) {
      const candidate = this.nextPassOf(layer, outputSec);
      if (candidate !== null && (next === null || candidate.outputStartSec < next.outputStartSec)) next = candidate;
    }
    return next;
  }

  isEmpty(): boolean {
    return this.layers.length === 0;
  }

  private nextPassOf(layer: FootageLayer, outputSec: number): FootagePass | null {
    if (outputSec < layer.outputStartSec) return this.passOf(layer, 0);
    if (outputSec >= layer.outputEndSec) return null;
    const pass = this.passOf(layer, this.passIndexAt(layer, outputSec) + 1);
    return pass.outputStartSec < layer.outputEndSec ? pass : null;
  }

  private passIndexAt(layer: FootageLayer, outputSec: number): number {
    return Math.floor((outputSec - layer.outputStartSec) / this.passSecOf(layer));
  }

  private passOf(layer: FootageLayer, index: number): FootagePass {
    const passSec = this.passSecOf(layer);
    // A layer that never starts over has an infinite pass, and 0 × ∞ is NaN.
    const outputStartSec = index === 0 ? layer.outputStartSec : layer.outputStartSec + index * passSec;
    return { layer, outputStartSec, outputEndSec: Math.min(layer.outputEndSec, outputStartSec + passSec) };
  }

  private passSecOf(layer: FootageLayer): number {
    return layer.source.kind === 'video' ? layer.sourcePassSec : Infinity;
  }

  private covers(layer: FootageLayer, outputSec: number): boolean {
    return outputSec >= layer.outputStartSec && outputSec < layer.outputEndSec;
  }
}
