import type { SetShotLayerTransitionAction } from '@core/shot-transitions/actions/SetShotLayerTransitionAction';
import type { LayerTransitionEdge, LayerTransitionKind } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import type { SetShotLayerInsetTransitionAction } from '@core/shots/actions/SetShotLayerInsetTransitionAction';
import type { SetShotLayerSplitTransitionAction } from '@core/shots/actions/SetShotLayerSplitTransitionAction';
import type { ShotLayerInsetTransitionKind } from '@core/shots/domain/ShotLayerInsetTransitions';
import type { ShotLayerSplitTransitionKind } from '@core/shots/domain/ShotLayerSplitTransitions';

/** The layouts that play a transition at a layer's ends. */
export type LayerTransitionLayout = 'split' | 'inset';

/** A layer's transition at one end, as an operation's input gives it: what is left out keeps its value. */
export interface LayerTransitionInput {
  readonly kind?: LayerTransitionKind | 'cut' | undefined;
  readonly durationSec?: number | undefined;
}

/**
 * Sets how a split frame divides, or how a picture-in-picture box comes
 * in, at one end of a layer, the way the editor's Layout tab sets it: a
 * kind picked brings its suggested sound in place of the old kind's, and
 * a duration is kept within what the field allows. Each change is its
 * own undo step, which a history group around the caller folds into one.
 */
export class LayerTransitionWriter {
  constructor(
    private readonly picks: SetShotLayerTransitionAction,
    private readonly splits: SetShotLayerSplitTransitionAction,
    private readonly insets: SetShotLayerInsetTransitionAction,
  ) {}

  /** Whether `kind` plays in `layout`: a split slides or reveals, a box comes from the whole frame, and either cuts. */
  fits(layout: LayerTransitionLayout, kind: LayerTransitionKind | 'cut'): boolean {
    return layout === 'split' ? this.isSplitKind(kind) : this.isInsetKind(kind);
  }

  /**
   * Gives the layer `layerId`, laid out as `layout`, the transition
   * `transition` at `edge`. A kind that does not fit `layout` is left
   * unset.
   */
  write(layerId: string, layout: LayerTransitionLayout, edge: LayerTransitionEdge, transition: LayerTransitionInput): void {
    if (layout === 'split') this.writeSplit(layerId, edge, transition);
    else this.writeInset(layerId, edge, transition);
  }

  private writeSplit(layerId: string, edge: LayerTransitionEdge, { kind, durationSec }: LayerTransitionInput): void {
    if (kind !== undefined && this.isSplitKind(kind)) this.picks.pickSplit([layerId], edge, kind);
    if (durationSec !== undefined) this.splits.setDurationSec([layerId], edge, durationSec);
  }

  private writeInset(layerId: string, edge: LayerTransitionEdge, { kind, durationSec }: LayerTransitionInput): void {
    if (kind !== undefined && this.isInsetKind(kind)) this.picks.pickInset([layerId], edge, kind);
    if (durationSec !== undefined) this.insets.setDurationSec([layerId], edge, durationSec);
  }

  private isSplitKind(kind: LayerTransitionKind | 'cut'): kind is ShotLayerSplitTransitionKind {
    return kind === 'cut' || kind === 'slide' || kind === 'reveal';
  }

  private isInsetKind(kind: LayerTransitionKind | 'cut'): kind is ShotLayerInsetTransitionKind {
    return kind === 'cut' || kind === 'full';
  }
}
