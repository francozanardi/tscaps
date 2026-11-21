import type { PlacedSourcePicture } from '@tscaps/engine/advanced';

/**
 * The picture a preview has on screen, as pixels a consumer can sample —
 * the composed one, footage and grade included, while footage shows; where
 * backdrop layers draw it again (a transition between shots), the
 * picture as it lay beneath them, which a cutout is drawn in their
 * states from — and where the video's own picture landed on it, or null
 * where a layer hides it. Valid for the frame on screen when it was
 * asked for.
 */
export interface PreviewShownPicture {
  readonly canvas: HTMLCanvasElement;
  readonly sourcePicture: PlacedSourcePicture | null;
}
