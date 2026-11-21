import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Writes the CSS typed against one shot layer, or a shot's own video by
 * its `ShotVideoLayerId`, as the text of its style, leaving what its
 * fields and its motion record as it is: a declaration written over
 * theirs takes that field or that motion over. A shot still only
 * proposed is made real first, as any edit to a shot makes it.
 *
 * Consecutive edits of one layer's CSS coalesce into one undo step, so
 * typing does not flood the history. A layer no shot holds is left
 * alone.
 */
export class SetShotLayerCssAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
  ) {}

  execute(layerId: string, css: string): void {
    const shots = this.materializer.materializeFrom(this.store.snapshot());
    if (!shots.holdsStyleTarget(layerId)) return;
    const styles = shots.layerStyles.withCss(layerId, 'layer', css);
    if (styles === shots.layerStyles) return;
    this.store.commit('Edit layer CSS', `shotLayerCss:${layerId}`);
    this.store.patch({ shots: shots.withLayerStyles(styles) });
  }
}
