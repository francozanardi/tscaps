import type { FootageLayerFrameState } from '@tscaps/engine/advanced';

/**
 * The states the backdrop footage layers drawing the whole picture again
 * are in at a moment of source time, bottom to top: none where no such
 * layer is active. What is cut out of the picture to be laid over it
 * again is drawn in them, so it moves and fades with the picture.
 */
export interface PictureBackdropStates {
  statesAt(sourceSec: number): ReadonlyArray<FootageLayerFrameState>;
}
