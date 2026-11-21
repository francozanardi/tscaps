import type { EditorStore } from '@core/editor/store/EditorStore';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ProjectShot, ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SetShotLayerThroughAction } from '@core/shots/actions/SetShotLayerThroughAction';

/** How far a layer shows, as an answer says it: the last shot it shows on, and how many shots that makes with its own. */
export interface LayerRunReadout {
  readonly through: string;
  readonly shots: number;
}

/**
 * Sets the shots a layer shows on, for the operations that take a
 * `through` shot or move a layer to another shot, and says it in their
 * answers. A layer opens with the shot holding it and shows through the
 * shot named, a later one; naming its own shot ends it there.
 */
export class LayerRunWriter {
  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly setThrough: SetShotLayerThroughAction,
  ) {}

  /**
   * Why the shot `throughRef` names cannot be the last one shown on by a
   * layer that opens on `own`: it names no shot, or one before `own`.
   * Null where it can.
   */
  problemOf(own: ProjectShot, throughRef: string): OperationProblem | null {
    const through = this.shots.resolveShot(throughRef);
    if (!through.ok) return through.problem;
    if (through.value.index >= own.index) return null;
    return {
      severity: 'error',
      message: `${throughRef} comes before ${own.ref}, the shot the layer opens on. A layer shows from its own shot through a later one; to start it earlier, put it on the earlier shot.`,
      ref: throughRef,
    };
  }

  /** Has the layer `layerId` show through the shot `throughRef` names; nothing changes where {@link problemOf} would object. */
  write(layerId: string, throughRef: string): void {
    const through = this.shots.resolveShot(throughRef);
    if (through.ok) this.setThrough.execute(layerId, through.value.shot.id);
  }

  /**
   * Why a layer cannot be moved to open on the shot `shotRef` names and
   * show through `throughRef`: either names no shot, or `throughRef`
   * comes before `shotRef`. Null where it can.
   */
  moveProblemOf(shotRef: string, throughRef: string | undefined): OperationProblem | null {
    const shot = this.shots.resolveShot(shotRef);
    if (!shot.ok) return shot.problem;
    return throughRef === undefined ? null : this.problemOf(shot.value, throughRef);
  }

  /**
   * Has the layer `layerId` open on the shot `shotRef` names and show
   * through `throughRef`; left out, it shows as far as it did where that
   * is not before its new shot, and on that shot alone otherwise. The
   * same layer, all it holds kept. Nothing changes where
   * {@link moveProblemOf} would object.
   */
  moveTo(layerId: string, shotRef: string, throughRef: string | undefined): void {
    const shot = this.shots.resolveShot(shotRef);
    if (!shot.ok) return;
    if (throughRef === undefined) {
      this.setThrough.moveTo(layerId, shot.value.shot.id, this.lastKeptOn(layerId, shot.value));
      return;
    }
    const through = this.shots.resolveShot(throughRef);
    if (through.ok) this.setThrough.moveTo(layerId, shot.value.shot.id, through.value.shot.id);
  }

  /** The id of the last shot the layer `layerId` shows on now, where it is not before `opening`; null otherwise. */
  private lastKeptOn(layerId: string, opening: ProjectShot): string | null {
    const run = this.store.snapshot().shots.runOf(layerId);
    const last = run[run.length - 1];
    return last === undefined || last.startSec < opening.startSec ? null : last.id;
  }

  /**
   * How far the layer `layerId` shows now, for an answer: said where the
   * operation was asked to set it (`asked`) or the layer shows past its
   * own shot, and left out, as nothing, for a layer that simply shows on
   * its shot or that no shot holds.
   */
  answerOf(layerId: string, asked: boolean): LayerRunReadout | Record<string, never> {
    const run = this.store.snapshot().shots.runOf(layerId);
    const last = run[run.length - 1];
    if (last === undefined || (!asked && run.length === 1)) return {};
    return { through: this.parser.formatOf('shot', last.id), shots: run.length };
  }
}
