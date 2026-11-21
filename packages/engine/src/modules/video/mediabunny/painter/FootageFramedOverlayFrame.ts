import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';
import { CanvasFootagePicture } from '@modules/video/CanvasFootagePicture';
import { FootageFraming } from '@modules/video/FootageFraming';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootagePicture } from '@modules/video/FootagePicture';

/**
 * An overlay covering the frame, drawn in the states of the backdrop
 * layers that drew the picture it was cut from again: moved, blurred,
 * dimmed or faded as that picture was, so what was cut out of it stays
 * where it was cut from. Each state is applied over the one before, in
 * order, through a canvas of its own; nothing is filled beneath it.
 *
 * Drawn over the whole of `width × height`, wherever it is asked to be
 * drawn: it stands for something cut out of that frame.
 */
export class FootageFramedOverlayFrame implements OverlayFrame {
  constructor(
    private readonly overlay: OverlayFrame,
    private readonly states: ReadonlyArray<FootageLayerFrameState>,
    private readonly width: number,
    private readonly height: number,
  ) {}

  draw(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): void {
    let picture: FootagePicture = this.overlay;
    for (const state of this.states.slice(0, -1)) picture = this.framedOnCanvas(picture, state);
    const last = this.states[this.states.length - 1];
    if (last === undefined) picture.draw(context, 0, 0, this.width, this.height);
    else new FootageFraming(last, this.width, this.height).draw(context, picture, this.width, this.height);
  }

  private framedOnCanvas(picture: FootagePicture, state: FootageLayerFrameState): FootagePicture {
    const canvas = new OffscreenCanvas(this.width, this.height);
    new FootageFraming(state, this.width, this.height).draw(canvas.getContext('2d')!, picture, this.width, this.height);
    return new CanvasFootagePicture(canvas);
  }
}
