import type { Document } from '@tscaps/engine';
import type { AddCutAction } from '@core/cuts/actions/AddCutAction';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSceneExtentResolver } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/**
 * Keyboard gestures for the Timeline mode. Escape lets go of whatever is
 * held, and with nothing held closes a scene opened word by word; Delete
 * and Backspace cut what is held and then let go. Inert when nothing is
 * held or open.
 *
 * "Whatever is held" is a selected stretch of video or a held scene —
 * the two things the panel can have in hand, never both at once. A cut
 * is restorable and takes part in undo, so answering to either is worth
 * the occasional cut nobody meant to make.
 *
 * A scene held together with every scene after it is the exception:
 * Delete leaves it alone. The group is held to be carried, and cutting
 * from its first scene to its last would take out most of the video.
 *
 * Started and stopped by the cuts host based on the active mode, so
 * the global window listener is only attached while the Timeline panel
 * is the foreground surface. The host is also responsible for not
 * starting the controller from inside text inputs; the controller
 * additionally guards on `document.activeElement` so a focused input
 * inside the panel keeps its native behaviour.
 */
export class TimelineKeyboardShortcutsController {
  private document: Document | null = null;

  constructor(
    private readonly editing: TimelineEditingController,
    private readonly addCut: AddCutAction,
    private readonly extents: TimelineSceneExtentResolver,
  ) {}

  /**
   * Publishes the document the shortcuts act on. Handed over rather than
   * held from construction, so the controller — and the window listener
   * it owns — outlives every edit instead of being rebuilt by each one.
   */
  setDocument(document: Document | null): void {
    this.document = document;
  }

  start(): void {
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.isTextInputFocused()) return;
    const selection = this.editing.selection;
    if (event.key === 'Escape') {
      if (selection || this.editing.selectedSceneId !== null) {
        event.preventDefault();
        this.editing.clearSelection();
        return;
      }
      if (this.editing.openedScene === null) return;
      event.preventDefault();
      this.editing.closeScene();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const range = selection ?? this.heldSceneRange();
      if (!range) return;
      event.preventDefault();
      this.addCut.execute({ startSec: range.startSec, endSec: range.endSec });
      this.editing.clearSelection();
    }
  };

  /**
   * The stretch the held scene occupies, resolved now rather than when
   * it was picked up: dragging an edge moves it, and a copy taken
   * earlier would cut where the scene used to be.
   */
  private heldSceneRange(): { startSec: number; endSec: number } | null {
    const segmentId = this.editing.selectedSceneId;
    if (segmentId === null || this.editing.heldSceneIds.size > 1) return null;
    const segment = this.document?.getSegments().find((candidate) => candidate.id === segmentId);
    if (!segment) return null;
    const extent = this.extents.resolve([segment])[0];
    return extent ? { startSec: extent.startSec, endSec: extent.endSec } : null;
  }

  private isTextInputFocused(): boolean {
    const element = document.activeElement;
    if (!element) return false;
    const tag = element.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    return element instanceof HTMLElement && element.isContentEditable;
  }
}
