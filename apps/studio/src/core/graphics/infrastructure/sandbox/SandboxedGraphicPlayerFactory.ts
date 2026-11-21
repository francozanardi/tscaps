import { GraphicOpenFailedError } from '@core/graphics/domain/errors/GraphicOpenFailedError';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import type { GraphicFontFacesBuilder } from '@core/graphics/services/GraphicFontFacesBuilder';
import type { GraphicPictureSize } from '@core/graphics/infrastructure/sandbox/GraphicPictureSize';
import type { SandboxedGraphicPage } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPage';
import { SandboxedGraphicPlayer } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPlayer';

/**
 * Opens each graphic in a sandboxed frame of its own, kept off screen in
 * `container` (`SandboxedGraphicPlayer`), with the bundled fonts it
 * names held in its page.
 */
export class SandboxedGraphicPlayerFactory implements GraphicPlayerFactory {
  constructor(
    private readonly container: HTMLElement,
    private readonly page: SandboxedGraphicPage,
    private readonly fontFaces: GraphicFontFacesBuilder,
  ) {}

  async open(
    document: GraphicDocument,
    stage: GraphicStage,
    onMessage: (message: GraphicMessage) => void,
    pictureScale: number,
  ): Promise<GraphicPlayer> {
    const fontFaceCss = await this.fontFaces.build(document, stage);
    const picture = this.pictureSizeOf(stage, pictureScale);
    const player = new SandboxedGraphicPlayer(this.container, this.page.build(document, stage, fontFaceCss, picture), stage, picture, onMessage);
    try {
      await player.load();
    } catch (error) {
      player.dispose();
      throw new GraphicOpenFailedError({ cause: error });
    }
    return player;
  }

  /** The pixels a picture of `stage`'s box holds at `scale`: never more than the box, never less than one a side. */
  private pictureSizeOf(stage: GraphicStage, scale: number): GraphicPictureSize {
    const share = Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
    return {
      widthPx: Math.max(1, Math.round(stage.widthPx * share)),
      heightPx: Math.max(1, Math.round(stage.heightPx * share)),
    };
  }
}
