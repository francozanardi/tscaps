import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStatePatch } from '@core/editor/store/EditorStore';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * What a change to the shots that may lay layers out anew (a layer
 * switched to another layout, a layer added already laid out) brings
 * along outside the shots, so both land as one patch and one undo step.
 */
export interface ShotLayoutFollower {
  /** The patch that takes `state` to the shots `after`, with whatever their layouts bring along. */
  patchFor(state: EditorState, after: ShotPartition): EditorStatePatch;
}
