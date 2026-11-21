import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStatePatch } from '@core/editor/store/EditorStore';
import type { ShotLayoutFollower } from '@core/shots/domain/ShotLayoutFollower';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/** A layout that brings nothing along: the patch holds the shots alone. */
export class ShotsOnlyLayoutFollower implements ShotLayoutFollower {
  patchFor(_state: EditorState, after: ShotPartition): EditorStatePatch {
    return { shots: after };
  }
}
