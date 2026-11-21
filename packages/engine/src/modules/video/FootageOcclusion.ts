import type { FootageSource } from '@modules/video/FootageLayer';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import { FootageFraming } from '@modules/video/FootageFraming';

/**
 * Whether a layer, drawn in its state, hides everything beneath it —
 * the source's picture and every layer below. Only a video, or the
 * source's own picture, is known to be opaque, and only drawn at rest,
 * square-cornered, to cover a rect holding the whole frame; a backdrop
 * draws what is beneath it, so it hides nothing; an image or a GIF may
 * hold transparency, a contained or rounded picture leaves the frame showing around it, and
 * one faded, moved, blurred or cut lets it show through.
 *
 * The one answer to that question: what is drawn beneath a layer, and
 * what a reader of the drawn frame may take as hidden, both ask here.
 */
export class FootageOcclusion {
  constructor(
    private readonly kind: FootageSource['kind'],
    private readonly state: FootageLayerFrameState,
  ) {}

  /** On a frame of `frameWidth × frameHeight` pixels. */
  hidesWholeFrame(frameWidth: number, frameHeight: number): boolean {
    if (this.kind !== 'video' && this.kind !== 'source-picture') return false;
    const framing = new FootageFraming(this.state, frameWidth, frameHeight);
    return framing.isAtRest() && framing.coversWholeFrame();
  }
}
