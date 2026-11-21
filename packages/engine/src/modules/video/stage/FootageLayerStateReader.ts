import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootageStageProbe } from '@modules/video/stage/FootageStageProbe';

/** Reads how a footage layer's box on a stage is drawn, as the document has resolved it right now. */
export interface FootageLayerStateReader {
  /**
   * The state `box` is drawn in on a stage of `stageWidth × stageHeight`
   * pixels. `probe` resolves, on that stage, the lengths a custom
   * property of the box holds unevaluated.
   */
  read(box: HTMLElement, probe: FootageStageProbe, stageWidth: number, stageHeight: number): FootageLayerFrameState;
}
