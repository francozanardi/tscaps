import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { SplitTransitionEdge } from '@core/elements/domain/fields/SplitTransitionField';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementControlCssWriter, ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ShotLayerSplitTransitionKind, ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';

/**
 * Changes how a split frame divides as shot layers come in, or joins
 * back as they leave, for one layer or several picked together: records
 * the change as each layer's field and writes the declaration it makes
 * into the layer's CSS, as its layout's fields are written.
 *
 * Each call is one undo step, and a run of changes to the same duration
 * of the same layers — a slider dragged — coalesces into one. A layer
 * no shot holds is left alone, and a layer already saying the same
 * takes no change.
 */
export class SetShotLayerSplitTransitionAction {
  constructor(
    private readonly store: EditorStore,
    private readonly catalog: StyledElementCatalog,
    private readonly controls: ElementControlCssWriter,
    private readonly transitions: ShotLayerSplitTransitions,
  ) {}

  /** Gives every layer of `layerIds` the transition `kind` at `edge`. */
  setKind(layerIds: ReadonlyArray<string>, edge: SplitTransitionEdge, kind: ShotLayerSplitTransitionKind): void {
    const value = this.transitions.valueOf(kind);
    this.write(layerIds, this.transitions.kindFieldOf(edge), value, `=${value}`);
  }

  /**
   * `shots` with every layer of `layerIds` it holds given the transition
   * `kind` at `edge`, as {@link setKind} records it, without committing:
   * for an edit that changes more than the layers in the same step. The
   * same partition where nothing changes.
   */
  withKind(shots: ShotPartition, layerIds: ReadonlyArray<string>, edge: SplitTransitionEdge, kind: ShotLayerSplitTransitionKind): ShotPartition {
    return this.revised(shots, layerIds, this.transitions.kindFieldOf(edge), this.transitions.valueOf(kind));
  }

  /** Sets how long the transition at `edge` takes, in seconds, kept within what the field allows. */
  setDurationSec(layerIds: ReadonlyArray<string>, edge: SplitTransitionEdge, seconds: number): void {
    const fieldId = this.transitions.durationFieldOf(edge);
    const control = this.catalog.requireControl('layer', fieldId);
    const allowed = Math.min(control.max ?? seconds, Math.max(control.min ?? seconds, seconds));
    this.write(layerIds, fieldId, allowed, '');
  }

  private write(layerIds: ReadonlyArray<string>, fieldId: ElementFieldId, value: ElementControlValue, change: string): void {
    const shots = this.store.snapshot().shots;
    const next = this.revised(shots, layerIds, fieldId, value);
    if (next === shots) return;
    this.store.commit('Change transition', `shotLayerSplitTransition:${[...layerIds].sort().join(',')}:${fieldId}${change}`);
    this.store.patch({ shots: next });
  }

  private revised(shots: ShotPartition, layerIds: ReadonlyArray<string>, fieldId: ElementFieldId, value: ElementControlValue): ShotPartition {
    let styles = shots.layerStyles;
    for (const layerId of layerIds) {
      if (shots.findLayer(layerId) === null) continue;
      styles = this.written(styles, layerId, fieldId, value);
    }
    return styles === shots.layerStyles ? shots : shots.withLayerStyles(styles);
  }

  private written(styles: ElementStyles, layerId: string, fieldId: ElementFieldId, value: ElementControlValue): ElementStyles {
    const style = styles.get(layerId);
    if (style?.fields?.[fieldId] === value) return styles;
    const control = this.catalog.requireControl('layer', fieldId);
    return styles.withField(layerId, 'layer', fieldId, value, this.controls.write(style?.css ?? '', control, value));
  }
}
