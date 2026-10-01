import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { WordTimeRange } from '@core/captions/services/WordTimeBounds';

/** Which of a selection's two edges the last gesture moved. */
export type TimelineSelectionEdge = 'start' | 'end';

/** An edit holding both where its subject was and where it is being taken. */
interface EditedRange {
  readonly originalRange: { readonly startSec: number; readonly endSec: number };
  readonly range: { readonly startSec: number; readonly endSec: number };
}

export interface TimelineSelection {
  readonly startSec: number;
  readonly endSec: number;
  readonly focusEdge: TimelineSelectionEdge;
}

export interface TimelineCutEdit {
  readonly originalRange: CutRange;
  readonly range: CutRange;
}

export interface CutEditEndResult {
  readonly originalRange: CutRange;
  readonly newRange: CutRange;
}

/**
 * A live preview of the window a scene is being dragged to. Carries what
 * it takes to draw the scene, since the window can be pulled into a
 * stretch of timeline that never held it.
 */
export interface TimelineSceneEdit {
  readonly segmentId: string;
  readonly text: string;
  readonly toneIndex: number;
  readonly originalRange: WordTimeRange;
  readonly range: WordTimeRange;
}

export interface SceneEditEndResult {
  readonly segmentId: string;
  readonly range: WordTimeRange;
}

/**
 * Everything needed to draw a scene being moved, so a surface can render
 * it from the move alone: it may be carried into stretches of timeline
 * that never held it.
 */
export interface TimelineSceneMoveSubject {
  readonly segmentId: string;
  readonly text: string;
  readonly toneIndex: number;
  /** The window it is shown for. */
  readonly window: WordTimeRange;
  /** The window and its words together, which is what it occupies on the timeline. */
  readonly extent: WordTimeRange;
  /** From its first word's start to its last word's end; `null` with no words. */
  readonly words: WordTimeRange | null;
}

/** A live preview of scenes being carried through time as one block. */
export interface TimelineSceneMove {
  readonly subjects: ReadonlyArray<TimelineSceneMoveSubject>;
  readonly deltaSec: number;
  /** Everything the subjects occupy where they are stored. */
  readonly originalRange: WordTimeRange;
  /** The same stretch, where they are being taken. */
  readonly range: WordTimeRange;
}

/**
 * A scene opened to be edited word by word while the rest of the
 * timeline is read scene by scene.
 */
export interface TimelineOpenedScene {
  readonly segmentId: string;
  /**
   * What the scene occupied when it was opened — its window and its words
   * together. The words are kept inside it, and a press outside it closes
   * the scene. Fixed at opening, so an edit inside cannot move the place a
   * press has to land to leave.
   */
  readonly extent: WordTimeRange;
}

export interface SceneMoveEndResult {
  readonly segmentIds: ReadonlyArray<string>;
  readonly deltaSec: number;
}

/**
 * Everything needed to draw the word being dragged, so a surface can
 * render it from the edit alone. A word may be pulled outside the
 * stretch of timeline it was projected into, and the surface it lands
 * on has no other way to know it exists.
 */
export interface TimelineWordEditSubject {
  readonly wordId: string;
  readonly text: string;
  readonly segmentId: string;
}

export interface TimelineWordEdit extends TimelineWordEditSubject {
  readonly originalRange: WordTimeRange;
  readonly range: WordTimeRange;
}

export interface WordEditEndResult {
  readonly wordId: string;
  readonly range: WordTimeRange;
}

const MIN_SELECTION_SEC = 0.01;

const NO_SCENES: ReadonlySet<string> = new Set();

/**
 * Observable selection state for the Timeline mode. Subscribers listen for
 * `'change'`. The controller deliberately does not own the cuts list —
 * committed cuts live in the editor store so they participate in
 * undo/redo.
 *
 * A selection is a plain time interval, not a per-row range. Rows in
 * the cuts timeline are equal slices of the clock laid end to end, so
 * an interval covering several rows needs no extra bookkeeping: each
 * row renders the part of the interval that falls inside its own
 * bounds.
 *
 * `focusEdge` names the edge the gesture last moved; the opposite edge
 * is the anchor it grew from. Surfaces that must point at "where the
 * user is working" read it.
 *
 * Four gestures are tracked, mutually exclusive:
 *
 * - **Fresh drag-selection** on an empty zone (`startDrag` →
 *   `extendDrag` → `endDrag`).
 * - **Selection edge-drag** (`startEdgeDrag` → `extendDrag` →
 *   `endDrag`) resizes the live selection by anchoring the opposite
 *   edge.
 * - **Cut edge-drag** (`startCutEdit` → `extendCutEdit` →
 *   `endCutEdit`) holds a live preview of a stored cut's new range
 *   without mutating the registry; the consumer commits the result on
 *   release. Starts by clearing any selection so the surface only
 *   shows one ephemeral state at a time.
 * - **Word time edit** (`startWordEdit` → `updateWordEdit` →
 *   `endWordEdit`) holds a live preview of a word's new range, again
 *   committed by the consumer on release.
 * - **Scene move** (`startSceneMove` → `updateSceneMove` →
 *   `endSceneMove`) holds how far a block of scenes is being carried,
 *   committed the same way.
 *
 * Telling a drag apart from a click is the caller's job, in pixels:
 * every `extendDrag` here is taken at face value. `MIN_SELECTION_SEC`
 * only guards the entry points that name a range outright, where a
 * degenerate range would be meaningless.
 */
export class TimelineEditingController extends EventTarget {

  private _selection: TimelineSelection | null = null;
  private _dragAnchorSec: number | null = null;

  private _cutEdit: TimelineCutEdit | null = null;
  private _cutEditAnchorSec: number | null = null;

  private _wordEdit: TimelineWordEdit | null = null;

  private _selectedSceneId: string | null = null;
  private _heldSceneIds: ReadonlySet<string> = NO_SCENES;
  private _sceneEdit: TimelineSceneEdit | null = null;
  private _sceneMove: TimelineSceneMove | null = null;
  private _openedScene: TimelineOpenedScene | null = null;

  get sceneEdit(): TimelineSceneEdit | null {
    return this._sceneEdit;
  }

  get sceneMove(): TimelineSceneMove | null {
    return this._sceneMove;
  }

  /**
   * The scene opened word by word, or `null`. Not a hold: it is a way of
   * reading one scene, so it survives selecting a stretch inside it and a
   * press anywhere outside the panel, and lasts until the reader turns to
   * something else in the panel.
   */
  get openedScene(): TimelineOpenedScene | null {
    return this._openedScene;
  }

  /** Opens a scene word by word, closing any other and letting go of whatever was held. */
  openScene(segmentId: string, extent: WordTimeRange): void {
    this.releaseScenes();
    this._selection = null;
    this._dragAnchorSec = null;
    this.cancelCutEditSilently();
    this._openedScene = { segmentId, extent };
    this.notify();
  }

  closeScene(): void {
    if (this._openedScene === null) return;
    this._openedScene = null;
    this.notify();
  }

  /**
   * Closes the opened scene when `atSec` falls outside what it occupies,
   * so a press beside it reads as leaving it while a press inside it —
   * between its words — does not.
   */
  closeSceneIfOutside(atSec: number): void {
    const opened = this._openedScene;
    this.closeSceneOtherThan(null, atSec);
    if (this._openedScene !== opened) this.notify();
  }

  get selection(): TimelineSelection | null {
    return this._selection;
  }

  /**
   * The scene the reader has taken hold of, or `null`.
   *
   * A **scene** and a **selection** are different objects and only one
   * of them stands at a time. A selection is a stretch of video with no
   * identity, whose actions are cut and loop; a scene is a thing in the
   * document, whose edges move its own window. Letting both stand would
   * put two pairs of grab points on screen meaning opposite things.
   */
  get selectedSceneId(): string | null {
    return this._selectedSceneId;
  }

  /**
   * Every scene held, which is the one in `selectedSceneId` alone unless
   * that scene was taken with every scene before or after it. Carrying any of them
   * carries them all. The same set is handed back until the hold changes,
   * so it can be compared by identity.
   */
  get heldSceneIds(): ReadonlySet<string> {
    return this._heldSceneIds;
  }

  get cutEdit(): TimelineCutEdit | null {
    return this._cutEdit;
  }

  get wordEdit(): TimelineWordEdit | null {
    return this._wordEdit;
  }

  /**
   * The in-progress cut resize when it has something to say about the
   * stretch `[startSec, endSec)`, otherwise `null`.
   *
   * "Something to say" is the **union** of where the cut is stored and
   * where it is being dragged to: a row the preview has reached does not
   * hold the stored cut yet, and would otherwise draw nothing until the
   * gesture was released.
   */
  /** Takes hold of a scene, dropping whatever was held before. */
  selectScene(segmentId: string): void {
    if (this._selectedSceneId === segmentId && this._heldSceneIds.size === 1) return;
    this.hold(segmentId, new Set([segmentId]));
  }

  /**
   * Takes hold of a scene together with others — the ones after it, say —
   * so carrying any of them carries them all. `segmentId` is the scene
   * the reader took hold of; `segmentIds` holds the whole group, and the
   * scene is added to it if missing.
   */
  selectSceneGroup(segmentId: string, segmentIds: ReadonlySet<string>): void {
    this.hold(segmentId, new Set([segmentId, ...segmentIds]));
  }

  clearSceneSelection(): void {
    if (this._selectedSceneId === null) return;
    this.releaseScenes();
    this.notify();
  }

  cutEditReaching(startSec: number, endSec: number): TimelineCutEdit | null {
    return this.reaching(this._cutEdit, startSec, endSec);
  }

  /**
   * The in-progress word edit when its span reaches `[startSec, endSec)`,
   * otherwise `null`. Same union rule as `cutEditReaching`, so the
   * stretch losing the word and the stretch gaining it both hear about
   * it.
   */
  wordEditReaching(startSec: number, endSec: number): TimelineWordEdit | null {
    return this.reaching(this._wordEdit, startSec, endSec);
  }

  get isDragging(): boolean {
    return this._dragAnchorSec !== null;
  }

  get isCutEditing(): boolean {
    return this._cutEdit !== null;
  }

  /** Whether any gesture is currently in flight. */
  get isGestureActive(): boolean {
    return this._dragAnchorSec !== null
      || this._cutEdit !== null
      || this._wordEdit !== null
      || this._sceneEdit !== null
      || this._sceneMove !== null;
  }

  startDrag(atSec: number): void {
    this.cancelCutEditSilently();
    this.releaseScenes();
    this.closeSceneOtherThan(null, atSec);
    this._dragAnchorSec = atSec;
    this._selection = null;
    this.notify();
  }

  /**
   * Begins a selection edge-drag with `anchorSec` as the fixed edge.
   * Caller passes the opposite edge of the live selection so the
   * pointer's position controls the moving edge. The current selection
   * is preserved until the first `extendDrag` updates it.
   */
  startEdgeDrag(anchorSec: number): void {
    this.cancelCutEditSilently();
    this._dragAnchorSec = anchorSec;
    this.notify();
  }

  extendDrag(toSec: number): void {
    if (this._dragAnchorSec === null) return;
    const anchor = this._dragAnchorSec;
    const next: TimelineSelection = {
      startSec: Math.min(anchor, toSec),
      endSec: Math.max(anchor, toSec),
      focusEdge: toSec >= anchor ? 'end' : 'start',
    };
    if (this.matchesSelection(next)) return;
    this._selection = next;
    this.notify();
  }

  endDrag(): void {
    if (this._dragAnchorSec === null) return;
    this._dragAnchorSec = null;
    this.notify();
  }

  /**
   * Begins a cut edge-drag. `originalRange` is the stored cut being
   * resized; `anchorSec` is the opposite edge that stays fixed. The
   * preview starts at the original range and updates as the pointer
   * moves. The current selection is cleared so the row only shows the
   * cut preview.
   */
  startCutEdit(originalRange: CutRange, anchorSec: number): void {
    this._cutEdit = { originalRange, range: originalRange };
    this._cutEditAnchorSec = anchorSec;
    this._dragAnchorSec = null;
    this._selection = null;
    this.releaseScenes();
    this.notify();
  }

  extendCutEdit(toSec: number): void {
    if (this._cutEdit === null || this._cutEditAnchorSec === null) return;
    const anchor = this._cutEditAnchorSec;
    const next: CutRange = {
      startSec: Math.min(anchor, toSec),
      endSec: Math.max(anchor, toSec),
    };
    if (next.endSec - next.startSec < MIN_SELECTION_SEC) return;
    if (this._cutEdit.range.startSec === next.startSec && this._cutEdit.range.endSec === next.endSec) return;
    this._cutEdit = { ...this._cutEdit, range: next };
    this.notify();
  }

  /**
   * Concludes the cut edge-drag. Returns the original and new ranges
   * when they differ so the caller can commit; returns `null` when
   * nothing changed (a click-without-drag on a handle).
   */
  endCutEdit(): CutEditEndResult | null {
    if (this._cutEdit === null) return null;
    const { originalRange, range } = this._cutEdit;
    this._cutEdit = null;
    this._cutEditAnchorSec = null;
    this.notify();
    if (originalRange.startSec === range.startSec && originalRange.endSec === range.endSec) {
      return null;
    }
    return { originalRange, newRange: range };
  }

  /**
   * Begins a word time edit. Holds a live preview of the word's new
   * range without touching the document — committing on every frame
   * would re-run the whole effects pipeline — so the consumer applies
   * the result on release. Clears any selection so the row only shows
   * one ephemeral state at a time.
   */
  startWordEdit(subject: TimelineWordEditSubject, originalRange: WordTimeRange): void {
    this._wordEdit = { ...subject, originalRange, range: originalRange };
    this._dragAnchorSec = null;
    this._selection = null;
    this.cancelCutEditSilently();
    this.notify();
  }

  /** Replaces the previewed range. The caller owns clamping and snapping. */
  updateWordEdit(range: WordTimeRange): void {
    const current = this._wordEdit;
    if (current === null) return;
    if (current.range.startSec === range.startSec && current.range.endSec === range.endSec) return;
    this._wordEdit = { ...current, range };
    this.notify();
  }

  /**
   * Concludes the word time edit. Returns the word and its new range
   * when it moved; returns `null` when nothing changed, so a press that
   * never turned into a drag commits nothing.
   */
  endWordEdit(): WordEditEndResult | null {
    const edit = this._wordEdit;
    if (edit === null) return null;
    this._wordEdit = null;
    this.notify();
    const { originalRange, range } = edit;
    if (originalRange.startSec === range.startSec && originalRange.endSec === range.endSec) return null;
    return { wordId: edit.wordId, range };
  }

  /**
   * Begins a scene window edit. Same shape as the word edit and for the
   * same reason: writing the window on every frame would re-run the
   * effects pipeline over the whole document, so the consumer applies
   * the result on release.
   *
   * The scene stays held throughout — the edit is something being done
   * *to* the selected scene, not a different state that replaces it.
   */
  startSceneEdit(
    subject: { readonly segmentId: string; readonly text: string; readonly toneIndex: number },
    originalRange: WordTimeRange,
  ): void {
    const { segmentId, text, toneIndex } = subject;
    this.closeSceneOtherThan(segmentId);
    this._sceneEdit = { segmentId, text, toneIndex, originalRange, range: originalRange };
    this._dragAnchorSec = null;
    this._selection = null;
    this.cancelCutEditSilently();
    this.notify();
  }

  /** Replaces the previewed window. The caller owns clamping and snapping. */
  updateSceneEdit(range: WordTimeRange): void {
    const current = this._sceneEdit;
    if (current === null) return;
    if (range.endSec - range.startSec < MIN_SELECTION_SEC) return;
    if (current.range.startSec === range.startSec && current.range.endSec === range.endSec) return;
    this._sceneEdit = { ...current, range };
    this.notify();
  }

  /**
   * Concludes the scene window edit. Returns the scene and its new
   * window when it moved, and `null` when nothing changed, so a press
   * that never turned into a drag commits nothing.
   */
  endSceneEdit(): SceneEditEndResult | null {
    const edit = this._sceneEdit;
    if (edit === null) return null;
    this._sceneEdit = null;
    this.notify();
    const { originalRange, range } = edit;
    if (originalRange.startSec === range.startSec && originalRange.endSec === range.endSec) return null;
    return { segmentId: edit.segmentId, range };
  }

  /**
   * The in-progress scene window edit when it reaches `[startSec,
   * endSec)`. Same union rule as the other two edits.
   */
  sceneEditReaching(startSec: number, endSec: number): TimelineSceneEdit | null {
    return this.reaching(this._sceneEdit, startSec, endSec);
  }

  /**
   * Begins carrying scenes through time. Same shape as the other edits
   * and for the same reason: the consumer applies the result on release.
   * A held scene stays held — moving it is something done *to* it.
   */
  startSceneMove(subjects: ReadonlyArray<TimelineSceneMoveSubject>): void {
    if (subjects.length === 0) return;
    const originalRange = {
      startSec: Math.min(...subjects.map((subject) => subject.extent.startSec)),
      endSec: Math.max(...subjects.map((subject) => subject.extent.endSec)),
    };
    // Even a group carrying the opened scene closes it: the stretch it was
    // opened over is about to be somewhere else.
    this.closeSceneOtherThan(null);
    this._sceneMove = { subjects, deltaSec: 0, originalRange, range: originalRange };
    this._dragAnchorSec = null;
    this._selection = null;
    this.cancelCutEditSilently();
    this.notify();
  }

  /** Replaces how far the scenes are carried. The caller owns clamping and snapping. */
  updateSceneMove(deltaSec: number): void {
    const current = this._sceneMove;
    if (current === null || current.deltaSec === deltaSec) return;
    const { originalRange } = current;
    this._sceneMove = {
      ...current,
      deltaSec,
      range: { startSec: originalRange.startSec + deltaSec, endSec: originalRange.endSec + deltaSec },
    };
    this.notify();
  }

  /**
   * Concludes the move. Returns what moved and how far, and `null` when
   * the scenes ended where they started.
   */
  endSceneMove(): SceneMoveEndResult | null {
    const move = this._sceneMove;
    if (move === null) return null;
    this._sceneMove = null;
    this.notify();
    if (move.deltaSec === 0) return null;
    return { segmentIds: move.subjects.map((subject) => subject.segmentId), deltaSec: move.deltaSec };
  }

  /** The in-progress scene move when it reaches `[startSec, endSec)`. Same union rule as the edits. */
  sceneMoveReaching(startSec: number, endSec: number): TimelineSceneMove | null {
    return this.reaching(this._sceneMove, startSec, endSec);
  }

  /**
   * Drops the selection when `atSec` falls outside it, and leaves it
   * standing otherwise, so pointing somewhere the selection does not
   * reach reads as dismissing it while pointing inside it does not.
   */
  clearSelectionIfOutside(atSec: number): void {
    const selection = this._selection;
    if (selection === null) return;
    if (atSec >= selection.startSec && atSec <= selection.endSec) return;
    this.clearSelection();
  }

  clearSelection(): void {
    if (this._selection === null
      && this._dragAnchorSec === null
      && this._cutEdit === null
      && this._wordEdit === null
      && this._sceneEdit === null
      && this._sceneMove === null
      && this._selectedSceneId === null) return;
    this._selection = null;
    this._dragAnchorSec = null;
    this._cutEdit = null;
    this._cutEditAnchorSec = null;
    this._wordEdit = null;
    this._sceneEdit = null;
    this._sceneMove = null;
    this.releaseScenes();
    this.notify();
  }

  /**
   * Replaces the current selection with the given range, cancelling any
   * in-progress drag. Used by UI affordances that map a single click on
   * a discrete element (a word chip, a silence chip) to a selection
   * that exactly covers that element's time range. Ranges shorter than
   * `MIN_SELECTION_SEC` are ignored.
   */
  selectRange(startSec: number, endSec: number): void {
    if (endSec - startSec < MIN_SELECTION_SEC) return;
    const next: TimelineSelection = { startSec, endSec, focusEdge: 'end' };
    this.cancelCutEditSilently();
    this._dragAnchorSec = null;
    this.releaseScenes();
    if (this.matchesSelection(next)) return;
    this._selection = next;
    this.notify();
  }

  // One rule for both edits, because they ask the same question and a
  // second copy of it is how the panel once ended up with two answers
  // that disagreed on a stretch ending exactly on a row's boundary.
  private reaching<TEdit extends EditedRange>(
    edit: TEdit | null,
    startSec: number,
    endSec: number,
  ): TEdit | null {
    if (!edit) return null;
    const editStartSec = Math.min(edit.originalRange.startSec, edit.range.startSec);
    const editEndSec = Math.max(edit.originalRange.endSec, edit.range.endSec);
    if (editEndSec <= startSec || editStartSec >= endSec) return null;
    return edit;
  }

  private matchesSelection(candidate: TimelineSelection): boolean {
    const current = this._selection;
    if (current === null) return false;
    return current.startSec === candidate.startSec
      && current.endSec === candidate.endSec
      && current.focusEdge === candidate.focusEdge;
  }

  private hold(segmentId: string, segmentIds: ReadonlySet<string>): void {
    this.cancelCutEditSilently();
    this.closeSceneOtherThan(segmentId);
    this._selectedSceneId = segmentId;
    this._heldSceneIds = segmentIds;
    this._selection = null;
    this._dragAnchorSec = null;
    this.notify();
  }

  // Turning to another scene, or to a stretch of the panel the opened one
  // does not reach, is what leaving it looks like. Callers already notify.
  private closeSceneOtherThan(segmentId: string | null, atSec?: number): void {
    const opened = this._openedScene;
    if (opened === null || opened.segmentId === segmentId) return;
    if (atSec !== undefined && atSec >= opened.extent.startSec && atSec <= opened.extent.endSec) return;
    this._openedScene = null;
  }

  private releaseScenes(): void {
    this._selectedSceneId = null;
    this._heldSceneIds = NO_SCENES;
  }

  private cancelCutEditSilently(): void {
    this._cutEdit = null;
    this._cutEditAnchorSec = null;
  }

  private notify(): void {
    this.dispatchEvent(new Event('change'));
  }
}
