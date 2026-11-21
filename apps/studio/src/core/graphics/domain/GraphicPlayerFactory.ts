import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';

/** Opens graphics to be played. */
export interface GraphicPlayerFactory {
  /**
   * Opens `document` on `stage`, resolving once it is ready to draw; every
   * line its code logs and every error it throws, now or later, goes to
   * `onMessage`. Rejects with `GraphicOpenFailedError` when it never
   * becomes ready.
   *
   * `pictureScale` is how large its pictures are handed over, as a share
   * of its box: 1 for the box's own size, less where they will be drawn
   * smaller. The graphic is laid out in its box at any scale, so it
   * shows the same thing; only the pixels handed over are fewer.
   */
  open(
    document: GraphicDocument,
    stage: GraphicStage,
    onMessage: (message: GraphicMessage) => void,
    pictureScale: number,
  ): Promise<GraphicPlayer>;
}
