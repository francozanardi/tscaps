import type { SelectableShotLayer } from '@presentation/shots/services/SelectableShotLayerReader';

/** Whether the shots panel is picking layers, and which are picked. */
export interface ShotLayerSelectionModeSnapshot {
  readonly isActive: boolean;
  readonly selectedLayerIds: ReadonlySet<string>;
}

const IDLE: ShotLayerSelectionModeSnapshot = { isActive: false, selectedLayerIds: new Set() };

/**
 * The shots panel's layer selection: a temporary mode in which pressing
 * a layer's pill picks it instead of opening it, so several can be
 * edited or removed at once. Observable through `subscribe`, read
 * through `snapshot()`.
 *
 * Every gesture is given the layers that can be picked right now, in
 * the order the panel shows them (`SelectableShotLayerReader`): a range
 * runs along that order, and nothing outside it can end up picked.
 *
 * The selection is not application state: it is never stored and has
 * no meaning outside the mode, which is why it lives here and not in
 * core. Edits made to the picked layers leave it as it is, so several
 * changes can be made to one set; `retain` drops whatever stopped
 * existing.
 */
export class ShotLayerSelectionModeController {
  private readonly subscribers = new Set<() => void>();
  private current: ShotLayerSelectionModeSnapshot = IDLE;
  // The layer a Shift-press extends from: the last one pressed.
  private anchorLayerId: string | null = null;

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  snapshot(): ShotLayerSelectionModeSnapshot {
    return this.current;
  }

  /** Starts picking, with nothing picked. Starting again while active starts over. */
  enter(): void {
    this.anchorLayerId = null;
    this.replace({ isActive: true, selectedLayerIds: new Set() });
  }

  /** Stops picking and forgets what was picked. */
  exit(): void {
    if (!this.current.isActive) return;
    this.anchorLayerId = null;
    this.replace(IDLE);
  }

  /**
   * A press on `layerId`'s pill. A plain press picks it, or lets it go
   * if it was picked. With `extendRange`, every layer from the last one
   * pressed to this one, in `selectable`'s order, is picked as well,
   * keeping what was already picked; with no earlier press it is a
   * plain press. Nothing happens for a layer `selectable` does not list.
   */
  press(layerId: string, extendRange: boolean, selectable: ReadonlyArray<SelectableShotLayer>): void {
    if (!this.current.isActive) return;
    const order = selectable.map((layer) => layer.layerId);
    if (!order.includes(layerId)) return;
    const range = extendRange ? this.rangeTo(layerId, order) : null;
    const next = range === null ? this.toggled(layerId) : new Set([...this.current.selectedLayerIds, ...range]);
    this.anchorLayerId = layerId;
    this.replace({ ...this.current, selectedLayerIds: next });
  }

  /**
   * Picks `layerIds`, and only those, dropping what was picked before;
   * an empty list clears the selection. A layer `selectable` does not
   * list is left out. A later Shift-press extends from the last of them
   * in `selectable`'s order. Nobody is told when what is picked does
   * not change.
   */
  selectOnly(layerIds: ReadonlyArray<string>, selectable: ReadonlyArray<SelectableShotLayer>): void {
    if (!this.current.isActive) return;
    const wanted = new Set(layerIds);
    const picked = selectable.filter((layer) => wanted.has(layer.layerId)).map((layer) => layer.layerId);
    this.anchorLayerId = picked.at(-1) ?? null;
    if (this.isSelectionExactly(picked)) return;
    this.replace({ ...this.current, selectedLayerIds: new Set(picked) });
  }

  /**
   * Drops from the selection every layer `selectable` no longer lists —
   * removed, or its file gone — so what is picked is always what is
   * there. Nothing changes, and nobody is told, where all are listed.
   */
  retain(selectable: ReadonlyArray<SelectableShotLayer>): void {
    const live = new Set(selectable.map((layer) => layer.layerId));
    const kept = [...this.current.selectedLayerIds].filter((layerId) => live.has(layerId));
    if (this.anchorLayerId !== null && !live.has(this.anchorLayerId)) this.anchorLayerId = null;
    if (kept.length === this.current.selectedLayerIds.size) return;
    this.replace({ ...this.current, selectedLayerIds: new Set(kept) });
  }

  /**
   * The picked layers among `selectable`, in its order: the order the
   * panel shows them, whatever order they were picked in.
   */
  selectedIn(selectable: ReadonlyArray<SelectableShotLayer>): SelectableShotLayer[] {
    return selectable.filter((layer) => this.current.selectedLayerIds.has(layer.layerId));
  }

  /** The layers from the last one pressed to `layerId`, along `order`; null with no earlier press still listed. */
  private rangeTo(layerId: string, order: ReadonlyArray<string>): string[] | null {
    const anchorIndex = this.anchorLayerId === null ? -1 : order.indexOf(this.anchorLayerId);
    if (anchorIndex < 0) return null;
    const targetIndex = order.indexOf(layerId);
    return order.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
  }

  private isSelectionExactly(layerIds: ReadonlyArray<string>): boolean {
    const selected = this.current.selectedLayerIds;
    return layerIds.length === selected.size && layerIds.every((layerId) => selected.has(layerId));
  }

  private toggled(layerId: string): Set<string> {
    const next = new Set(this.current.selectedLayerIds);
    if (next.has(layerId)) next.delete(layerId);
    else next.add(layerId);
    return next;
  }

  private replace(next: ShotLayerSelectionModeSnapshot): void {
    this.current = next;
    for (const callback of this.subscribers) callback();
  }
}
