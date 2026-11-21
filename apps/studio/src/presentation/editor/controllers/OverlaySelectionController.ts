import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/**
 * A caption element picked in the subtitle overlay: a segment, or a
 * word (or the glyph on it) within `segmentId`. `segmentId` is anchored
 * to a specific active segment because multiple segments (across
 * sheets) may be active simultaneously.
 */
export interface CaptionSelection {
  readonly kind: 'caption';
  readonly segmentId: string;
  readonly wordId: string | null;
}

/** A shot layer picked on the preview or from its shot, by the layer's id. */
export interface ShotLayerSelection {
  readonly kind: 'shot-layer';
  readonly layerId: string;
}

/**
 * Several shot layers picked together from the shots panel, to be
 * edited as one, in the order they were picked. Never picked off the
 * frame: a press on a box picks that box alone.
 */
export interface ShotLayerGroupSelection {
  readonly kind: 'shot-layers';
  readonly layerIds: ReadonlyArray<string>;
}

/**
 * A shot picked from the shots panel to be inspected as a whole — what
 * its camera does with its own video. Never picked off the frame: a
 * press there picks what is drawn on it.
 */
export interface ShotSelection {
  readonly kind: 'shot';
  readonly shotId: string;
}

/** What is picked: a caption element, one shot layer, several, a shot, or nothing (`null`). */
export type OverlaySelection = CaptionSelection | ShotLayerSelection | ShotLayerGroupSelection | ShotSelection | null;

/** Viewport-coordinate anchor for the right-click popover; `null` when closed. */
export type OverlayPopoverAnchor = { x: number; y: number } | null;

// The size, in screen pixels, a word has to reach along an axis before
// a click on it is comfortable. A word smaller than this — a comma, a
// one-letter word, anything in a preview scaled well down — grows a
// snap margin on that axis until it measures up; a word already this
// big grows none. Beyond the reach the click stays a segment click.
const COMFORTABLE_TARGET_PX = 24;

/**
 * Owns which element of the preview the user is working on — a caption
 * element, a shot layer or several picked together — and the anchor of
 * the right-click popover over a caption. Lifecycle is `start()` /
 * `stop()`: start installs the window-level listeners (outside-pointerdown,
 * Escape); stop removes them. Observers subscribe via `subscribe` and
 * read state via `selectionSnapshot` / `paintedSelectionSnapshot` /
 * `popoverSnapshot`.
 *
 * The two states have deliberately different lifetimes. The popover is
 * ephemeral and closes the moment attention goes anywhere else. The
 * selection is what the user picked, and it lasts until the user lets it
 * go: on Escape, on picking something else, on {@link clearSelection},
 * and on a click on the editor's empty background — an element marked
 * `data-tscaps-deselect-zone`, hit itself rather than anything drawn on
 * it. Everything else keeps it: the sidebar editing it, the video and
 * its controls (playing and seeking are how a pick is looked at), the
 * panel's resize handle, the toolbar. Letting go happens only where
 * nothing else could have been meant.
 *
 * It survives the playhead moving off the element too. The selection
 * outliving what is on screen is the point: nothing about picking a word
 * says the user is done with it once the scene ends, and scrubbing back
 * finds it still picked. What the preview marks reads the narrower
 * `paintedSelectionSnapshot`, so no mark sits over something not drawn.
 *
 * Selection lives in presentation, not in core, because it is not
 * application state: it is not persisted and has no domain meaning.
 * `WordDragGesture` consults it synchronously to gate accidental drags.
 */
export class OverlaySelectionController {
  private readonly subscribers = new Set<() => void>();
  private readonly directPickSubscribers = new Set<() => void>();
  private selection: OverlaySelection = null;
  private popover: OverlayPopoverAnchor = null;
  private paintedSegmentIds: ReadonlySet<string> = new Set();
  private paintedShotLayerIds: ReadonlySet<string> = new Set();
  private onPointerDown: ((event: PointerEvent) => void) | null = null;
  private onKey: ((event: KeyboardEvent) => void) | null = null;

  start(): void {
    if (this.onPointerDown || this.onKey) return;
    // Bound to pointerdown rather than mousedown so a gesture starting on a
    // chrome element outside any `[data-tscaps-segment-id]` ancestor can keep
    // the popover alive by stopping propagation on its own pointerdown —
    // mousedown is a separate event stream and a `stopPropagation` on
    // pointerdown does not silence it.
    this.onPointerDown = (event) => {
      if (!this.selection && !this.popover) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-tscaps-segment-id]')) return;
      if (target.closest('[data-tscaps-shot-layer-id]')) return;
      if (target.closest('[data-floating-layer]')) return;
      if (target.hasAttribute('data-tscaps-deselect-zone')) this.clearSelection();
      else this.closePopover();
    };
    this.onKey = (event) => {
      // An Escape a popover or a menu took to close itself was its own,
      // not a request to let go of the element it was opened on.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Escape inside a field belongs to that field. A panel editing the
      // selected element is a text editor like any other, and losing the
      // selection out from under it would close the panel mid-sentence.
      if (target && this.isTextEntry(target)) return;
      this.clearSelection();
    };
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    if (this.onPointerDown) window.removeEventListener('pointerdown', this.onPointerDown);
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    this.onPointerDown = null;
    this.onKey = null;
    this.subscribers.clear();
    this.directPickSubscribers.clear();
    this.selection = null;
    this.popover = null;
    this.paintedSegmentIds = new Set();
    this.paintedShotLayerIds = new Set();
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  /**
   * Notified when the user picks an element by pointing straight at it
   * and asking for nothing else.
   *
   * Narrower than a selection change on purpose, and the three it
   * leaves out are the three where acting on the pick would be acting
   * on something the user did not say: a right-click, which asked for
   * the element's popover; a pick made on the user's behalf; and a
   * drag, whose click never arrives.
   */
  subscribeToDirectPicks(callback: () => void): () => void {
    this.directPickSubscribers.add(callback);
    return () => { this.directPickSubscribers.delete(callback); };
  }

  selectionSnapshot(): OverlaySelection {
    return this.selection;
  }

  /**
   * The same pick, narrowed to when it is being painted: a caption
   * element while its segment is, a shot layer while its stretch holds
   * the playhead, a shot while its own video does (counted as a layer
   * by its `ShotVideoLayerId`). `null` while the playhead is off it. Several layers
   * picked together are not narrowed: they sit in different shots, so
   * the playhead is off most of them whatever it does, and they were
   * picked from the panel rather than off the frame.
   *
   * What the preview marks reads this one, so a mark never sits over
   * something the preview is not drawing. A panel editing the pick reads
   * {@link selectionSnapshot} and tells this one apart only to say the
   * element is not on screen.
   */
  paintedSelectionSnapshot(): OverlaySelection {
    if (!this.selection) return null;
    switch (this.selection.kind) {
      case 'caption': return this.paintedSegmentIds.has(this.selection.segmentId) ? this.selection : null;
      case 'shot-layer': return this.paintedShotLayerIds.has(this.selection.layerId) ? this.selection : null;
      case 'shot-layers': return this.selection;
      case 'shot': return this.paintedShotLayerIds.has(ShotVideoLayerId.of(this.selection.shotId)) ? this.selection : null;
    }
  }

  /** Registers which segments the preview is painting right now. */
  setPaintedSegmentIds(ids: ReadonlySet<string>): void {
    if (this.paintedSegmentIds === ids) return;
    this.paintedSegmentIds = ids;
    this.emit();
  }

  /** Registers which shot layers the preview is showing right now, whatever their layout. */
  setPaintedShotLayerIds(ids: ReadonlySet<string>): void {
    if (this.paintedShotLayerIds === ids) return;
    this.paintedShotLayerIds = ids;
    this.emit();
  }

  popoverSnapshot(): OverlayPopoverAnchor {
    return this.popover;
  }

  setSelection(next: OverlaySelection): void {
    if (this.selection === next) return;
    this.selection = next;
    this.popover = null;
    this.emit();
  }

  /**
   * Picks a shot layer on the user's behalf — pressing it to drag it,
   * say — without asking for anything else. Re-picking the layer
   * already picked changes nothing.
   */
  selectShotLayer(layerId: string): void {
    if (this.isShotLayerSelected(layerId)) return;
    this.setSelection({ kind: 'shot-layer', layerId });
  }

  /**
   * Picks a shot layer because the user asked to work on it, which is
   * a direct pick: subscribers to those open what edits it.
   */
  pickShotLayer(layerId: string): void {
    this.selectShotLayer(layerId);
    this.emitDirectPick();
  }

  /**
   * Picks a caption element because the user asked to work on it from a
   * panel rather than off the frame — a word, or its scene where
   * `wordId` is null — which is a direct pick.
   */
  pickCaption(segmentId: string, wordId: string | null): void {
    this.setSelection({ kind: 'caption', segmentId, wordId });
    this.emitDirectPick();
  }

  /**
   * Picks several shot layers to be edited together, because the user
   * asked to, which is a direct pick. One layer is picked as itself;
   * none picks nothing and changes nothing.
   */
  pickShotLayers(layerIds: ReadonlyArray<string>): void {
    if (layerIds.length === 0) return;
    if (layerIds.length === 1) {
      this.pickShotLayer(layerIds[0]!);
      return;
    }
    this.setSelection({ kind: 'shot-layers', layerIds: [...layerIds] });
    this.emitDirectPick();
  }

  /** Picks a shot to inspect as a whole, because the user asked to, which is a direct pick. */
  pickShot(shotId: string): void {
    if (this.selection?.kind !== 'shot' || this.selection.shotId !== shotId) this.setSelection({ kind: 'shot', shotId });
    this.emitDirectPick();
  }

  /**
   * Resolves a pointer event landing on `target` (at viewport
   * coordinates `clientX`/`clientY`) into a selection: a caption
   * element, or failing that a shot layer. Captions are drawn above the
   * footage, so a point on both picks the caption. Returns false if the
   * point is on neither — caller decides what to do (currently:
   * nothing, the global pointerdown listener handles outside-click
   * dismissal). When `openPopover` is true, also opens the popover
   * anchored at the click point; a shot layer has none, so a
   * right-click on one picks it and opens nothing.
   *
   * `searchRoot` is the overlay scaler; word-snap searches the actual
   * `.segment` node under it, so a click landing on a scaler-level
   * segment hitzone (which also carries `data-tscaps-segment-id` but
   * no word descendants) can still snap to the nearest word.
   */
  selectAtPoint(target: HTMLElement, searchRoot: HTMLElement, clientX: number, clientY: number, openPopover: boolean): boolean {
    const hitEl = target.closest<HTMLElement>('[data-tscaps-segment-id]');
    if (!hitEl) return this.selectShotLayerAt(target, openPopover);
    const segmentId = hitEl.getAttribute('data-tscaps-segment-id')!;
    const segmentEl = searchRoot.querySelector<HTMLElement>(
      `.segment[data-tscaps-segment-id="${CSS.escape(segmentId)}"]`,
    ) ?? hitEl;
    const wordId = this.resolveWordId(target, clientX, clientY, segmentEl);
    this.selection = { kind: 'caption', segmentId, wordId };
    this.popover = openPopover ? { x: clientX, y: clientY } : null;
    this.emit();
    if (!openPopover) this.emitDirectPick();
    return true;
  }

  /** Drops the selection, and the popover with it — a popover over nothing means nothing. */
  clearSelection(): void {
    if (!this.selection && !this.popover) return;
    this.selection = null;
    this.popover = null;
    this.emit();
  }

  /** Closes the popover and leaves the selection where it is. */
  closePopover(): void {
    if (!this.popover) return;
    this.popover = null;
    this.emit();
  }

  private selectShotLayerAt(target: HTMLElement, openPopover: boolean): boolean {
    const hit = target.closest<HTMLElement>('[data-tscaps-shot-layer-id]');
    const layerId = hit?.getAttribute('data-tscaps-shot-layer-id');
    if (!layerId) return false;
    if (openPopover) this.selectShotLayer(layerId);
    else this.pickShotLayer(layerId);
    return true;
  }

  private isShotLayerSelected(layerId: string): boolean {
    return this.selection?.kind === 'shot-layer' && this.selection.layerId === layerId;
  }

  private isTextEntry(target: HTMLElement): boolean {
    return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
  }

  private resolveWordId(target: HTMLElement, clientX: number, clientY: number, segmentEl: HTMLElement): string | null {
    const direct = target.closest<HTMLElement>('[data-tscaps-word-id]');
    if (direct) return direct.getAttribute('data-tscaps-word-id');
    return this.snapToNearestWordId(segmentEl, clientX, clientY);
  }

  private snapToNearestWordId(segmentEl: HTMLElement, clientX: number, clientY: number): string | null {
    let nearestId: string | null = null;
    let nearestDistance = Infinity;
    for (const el of segmentEl.querySelectorAll<HTMLElement>('[data-tscaps-word-id]')) {
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      if (dx > this.reachAlong(rect.width) || dy > this.reachAlong(rect.height)) continue;
      const distance = Math.hypot(dx, dy);
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      nearestId = el.getAttribute('data-tscaps-word-id');
    }
    return nearestId;
  }

  /**
   * How far past one edge of a word the snap reaches, along the axis
   * that edge is on.
   *
   * Only what is too small to hit gets any reach, and only enough to
   * bring it up to size. A word already comfortable along an axis gets
   * none, which is what keeps the space around the text belonging to
   * the segment: a word spans its whole line box vertically, so it was
   * never the hard direction, and reaching there took the segment's
   * own click surface away for no gain.
   */
  private reachAlong(extent: number): number {
    return Math.max(0, (COMFORTABLE_TARGET_PX - extent) / 2);
  }

  private emit(): void {
    for (const callback of this.subscribers) callback();
  }

  private emitDirectPick(): void {
    for (const callback of this.directPickSubscribers) callback();
  }
}
