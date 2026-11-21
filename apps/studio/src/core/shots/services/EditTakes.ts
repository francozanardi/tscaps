import type { CutRange } from '@core/cuts/domain/CutRegistry';

// A stretch this short between two changes of picture is a flash or a dissolve, not a take of its own.
const MIN_TAKE_SEC = 0.3;

/** A layer that takes the frame over a stretch of the source video, hiding or re-framing the video under it. */
export interface FrameTakingLayer {
  readonly layerId: string;
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * A stretch over which a viewer sees one picture: the video in one
 * framing of its own (`layerId` null), or the layer that takes the frame
 * there. Times are of the source video; `watchedSec` is how long it
 * lasts once the cuts inside it are gone.
 */
export interface EditTake {
  readonly startSec: number;
  readonly endSec: number;
  readonly watchedSec: number;
  readonly layerId: string | null;
}

/**
 * Cuts an edit into its takes, as a viewer sees them: a take ends where
 * the video's own picture changes (a switch of camera, an edit already
 * in it) and where a layer that takes the frame comes in or goes out.
 * What leaves the picture the same (a zoom, a cut inside one framing, a
 * caption, anything set over the video) ends none. A take the cuts
 * remove whole is left out. Stateless.
 */
export class EditTakes {
  /**
   * The takes of a video `durationSec` long whose own picture changes at
   * `pictureChangesSec`, with `layers` taking the frame and `cuts`
   * removed, in time order.
   */
  of(durationSec: number, pictureChangesSec: ReadonlyArray<number>, layers: ReadonlyArray<FrameTakingLayer>, cuts: ReadonlyArray<CutRange>): EditTake[] {
    if (!(durationSec > 0)) return [];
    const bounds = this.boundsOf(durationSec, pictureChangesSec, layers);
    const takes: EditTake[] = [];
    for (let index = 0; index < bounds.length - 1; index += 1) {
      const [startSec, endSec] = [bounds[index]!, bounds[index + 1]!];
      const layerId = this.layerOver(layers, (startSec + endSec) / 2);
      const before = takes[takes.length - 1];
      if (before !== undefined && layerId !== null && before.layerId === layerId) takes[takes.length - 1] = { ...before, endSec };
      else takes.push({ startSec, endSec, watchedSec: 0, layerId });
    }
    return takes
      .map((take) => ({ ...take, watchedSec: this.watchedSecOf(take, cuts) }))
      .filter((take) => take.watchedSec > 0);
  }

  /** Where takes can start and end, ascending: the video's ends, where a layer comes in or goes out, and each change of the video's own far enough from the bound before it. */
  private boundsOf(durationSec: number, pictureChangesSec: ReadonlyArray<number>, layers: ReadonlyArray<FrameTakingLayer>): number[] {
    const inside = (sec: number): boolean => sec > 0 && sec < durationSec;
    const layerEdges = layers.flatMap((layer) => [layer.startSec, layer.endSec]).filter(inside);
    const changes = pictureChangesSec.filter(inside).filter((change) => layerEdges.every((edge) => Math.abs(edge - change) >= MIN_TAKE_SEC));
    const bounds = [0];
    for (const sec of [...new Set([...layerEdges, ...changes])].sort((first, second) => first - second)) {
      const fromLayer = layerEdges.includes(sec);
      if (!fromLayer && (sec - bounds[bounds.length - 1]! < MIN_TAKE_SEC || durationSec - sec < MIN_TAKE_SEC)) continue;
      bounds.push(sec);
    }
    bounds.push(durationSec);
    return bounds;
  }

  /** The layer taking the frame at `sec`: the last one listed where several do; null where none does. */
  private layerOver(layers: ReadonlyArray<FrameTakingLayer>, sec: number): string | null {
    let over: string | null = null;
    for (const layer of layers) if (sec >= layer.startSec && sec < layer.endSec) over = layer.layerId;
    return over;
  }

  private watchedSecOf(take: EditTake, cuts: ReadonlyArray<CutRange>): number {
    const cutSec = cuts.reduce((sum, cut) => sum + Math.max(0, Math.min(take.endSec, cut.endSec) - Math.max(take.startSec, cut.startSec)), 0);
    return Math.max(0, take.endSec - take.startSec - cutSec);
  }
}
