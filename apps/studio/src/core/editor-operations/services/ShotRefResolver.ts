import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Shot } from '@core/shots/domain/Shot';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';

/** A shot as the project holds it now: where it opens and ends, in seconds of the source video, and its place in order. */
export interface ProjectShot {
  readonly shot: Shot;
  readonly ref: string;
  /** 0 for the first shot. */
  readonly index: number;
  readonly startSec: number;
  readonly endSec: number;
}

/** A layer of a shot, with the shot that holds it. */
export interface ProjectLayer {
  readonly layer: ShotLayer;
  readonly ref: string;
  readonly shot: ProjectShot;
}

/**
 * Lists the shots and finds the shot or layer a ref names. Where the
 * person never edited a shot the editor still shows the shots it proposes
 * from the speech; those are listed too, under the ids they keep once an
 * edit makes them real, so a ref read before the first edit still holds
 * after it.
 */
export class ShotRefResolver {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly parser: EditorRefParser,
  ) {}

  /** Every shot, in order. Empty while the project has no video. */
  shots(): ProjectShot[] {
    const state = this.store.snapshot();
    const durationSec = state.video.duration;
    if (durationSec <= 0) return [];
    const shots = this.materializer.materializeFrom(state).list();
    return shots.map((shot, index) => ({
      shot,
      ref: this.parser.formatOf('shot', shot.id),
      index,
      startSec: shot.startSec,
      endSec: shots[index + 1]?.startSec ?? durationSec,
    }));
  }

  /** The shot `text` names (`shot:<id>`). */
  resolveShot(text: string): ResolvedRef<ProjectShot> {
    const ref = this.parser.parse(text);
    if (ref === null || ref.kind !== 'shot') return this.problem(text, `"${text}" is not a shot ref; shot refs look like shot:<id>.`);
    const shot = this.shots().find((each) => each.shot.id === ref.id);
    return shot === undefined
      ? this.problem(text, `${text} is not a shot of this project any more; list the shots again.`)
      : { ok: true, value: shot };
  }

  /** The shot covering `sec`, a time of the source video, or the last shot past its end. */
  shotAt(sec: number): ProjectShot | null {
    const shots = this.shots();
    return shots.find((each) => sec >= each.startSec && sec < each.endSec) ?? shots[shots.length - 1] ?? null;
  }

  /** The layer `text` names (`layer:<id>`), with its shot. */
  resolveLayer(text: string): ResolvedRef<ProjectLayer> {
    const ref = this.parser.parse(text);
    if (ref === null || ref.kind !== 'layer') return this.problem(text, `"${text}" is not a layer ref; layer refs look like layer:<id>.`);
    for (const shot of this.shots()) {
      const layer = shot.shot.layers.find((each) => each.id === ref.id);
      if (layer !== undefined) return { ok: true, value: { layer, ref: text, shot } };
    }
    return this.problem(text, `${text} is not on any shot any more; list the shots again.`);
  }

  private problem<T>(ref: string, message: string): ResolvedRef<T> {
    return { ok: false, problem: { severity: 'error', message, ref } };
  }
}
