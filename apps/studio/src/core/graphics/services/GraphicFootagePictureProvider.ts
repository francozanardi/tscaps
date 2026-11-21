import type { FootagePictureProvider, ProvidedFootagePictures } from '@tscaps/engine';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicFailureStage } from '@core/graphics/domain/GraphicFailureStage';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';

/**
 * A graphic's pictures as the engine asks for them: each opening plays
 * the graphic afresh on `stage`, its pictures standing for the stage's
 * size at the scale the opening asks for, and closing it lets the
 * player go. What the graphic says goes to
 * `onMessage`, from every opening, and the moments its code declared to
 * `onMoments`, once it is open.
 *
 * A failure to open or to draw goes to `onFailure` and still rejects as
 * before. A picture refused because its opening was closed meanwhile is
 * no failure of the graphic, and is not passed on.
 */
export class GraphicFootagePictureProvider implements FootagePictureProvider {
  constructor(
    private readonly players: GraphicPlayerFactory,
    private readonly document: GraphicDocument,
    private readonly stage: GraphicStage,
    private readonly onMessage: (message: GraphicMessage) => void,
    private readonly onMoments: (moments: ReadonlyArray<GraphicMoment>) => void,
    private readonly onFailure: (stage: GraphicFailureStage, error: unknown) => void,
  ) {}

  async open(scale: number): Promise<ProvidedFootagePictures> {
    const player = await this.openPlayer(scale);
    this.onMoments(player.moments);
    let closed = false;
    return {
      width: this.stage.widthPx,
      height: this.stage.heightPx,
      pictureAt: (sourceSec) => player.frameAt(sourceSec).catch((error: unknown) => {
        if (!closed) this.onFailure('frame', error);
        throw error;
      }),
      frameOf: (sourceSec) => player.frameOf(sourceSec),
      close: () => {
        closed = true;
        player.dispose();
      },
    };
  }

  private async openPlayer(pictureScale: number): Promise<GraphicPlayer> {
    try {
      return await this.players.open(this.document, this.stage, this.onMessage, pictureScale);
    } catch (error) {
      this.onFailure('open', error);
      throw error;
    }
  }
}
