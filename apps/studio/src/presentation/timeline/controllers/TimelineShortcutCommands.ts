import type { Document } from '@tscaps/engine';
import type { AddCutAction } from '@core/cuts/actions/AddCutAction';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSceneExtentResolver } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/**
 * What the Timeline mode's keyboard commands do. Releasing lets go of
 * whatever is held, and with nothing held leaves a scene opened word by
 * word; cutting cuts what is held and then lets go. Each answers `false`
 * when there was nothing to act on, so the keystroke stays free for
 * anything else that wants it.
 *
 * "Whatever is held" is a selected stretch of video or a held scene —
 * the two things the panel can have in hand, never both at once. A cut
 * is restorable and takes part in undo, so answering to either is worth
 * the occasional cut nobody meant to make.
 *
 * A scene held together with every scene after it is the exception:
 * cutting leaves it alone. The group is held to be carried, and cutting
 * from its first scene to its last would take out most of the video.
 */
export class TimelineShortcutCommands {
  private document: Document | null = null;

  constructor(
    private readonly editing: TimelineEditingController,
    private readonly addCut: AddCutAction,
    private readonly extents: TimelineSceneExtentResolver,
  ) {}

  /**
   * Publishes the document the commands act on. Handed over rather than
   * held from construction, so the instance outlives every edit instead
   * of being rebuilt by each one.
   */
  setDocument(document: Document | null): void {
    this.document = document;
  }

  release(): boolean {
    if (this.editing.selection || this.editing.selectedSceneId !== null) {
      this.editing.clearSelection();
      return true;
    }
    if (this.editing.openedScene === null) return false;
    this.editing.closeScene();
    return true;
  }

  cut(): boolean {
    const range = this.editing.selection ?? this.heldSceneRange();
    if (!range) return false;
    this.addCut.execute({ startSec: range.startSec, endSec: range.endSec });
    this.editing.clearSelection();
    return true;
  }

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
}
