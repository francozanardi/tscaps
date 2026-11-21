import type { FootageGrade, FootageLayer } from '@tscaps/engine';
import type { FootageLayerResolver } from '@tscaps/engine/advanced';

/**
 * The footage layers a preview draws over its picture, in output time,
 * bottom to top, and what resolves how each is drawn at a moment — there
 * and then, since the preview composes every animation frame and
 * cannot wait for an answer — on a frame of `frame`'s size, whose shape
 * need not be the picture's, or of the picture's own while null; and
 * the grade the whole picture is drawn in, null for none. A new value is a new answer
 * even where the layers are the same: how they look may have changed
 * while what they play did not.
 */
export interface PreviewFootage {
  readonly layers: ReadonlyArray<FootageLayer>;
  readonly resolver: FootageLayerResolver;
  readonly frame: { readonly width: number; readonly height: number } | null;
  /**
   * Where the output ends, in output time; null while not known. A
   * playhead resting there shows the video's last frame, so the layers
   * are drawn as they are on it rather than as they are once they end.
   */
  readonly outputEndSec: number | null;
  readonly grade: FootageGrade | null;
}
