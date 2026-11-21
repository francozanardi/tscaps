import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootagePicture } from '@modules/video/FootagePicture';
import type { FootageGrade } from '@modules/video/grade/FootageGrade';

/**
 * An active layer with the picture it shows at this moment, that
 * picture's own size, and the state it is drawn in.
 */
export interface FootageLayerPicture {
  readonly layer: FootageLayer;
  readonly picture: FootagePicture;
  readonly width: number;
  readonly height: number;
  readonly state: FootageLayerFrameState;
}

/**
 * One frame to compose. `video` is the source's own picture, whose own
 * size is `videoWidth × videoHeight`; null leaves the context as found
 * wherever the source's picture would show. `layers` are the layers
 * active at this moment, bottom to top; one showing the source's own
 * picture carries `video` as its picture. `grade`, when there is one,
 * grades the whole composed picture last.
 */
export interface FootageCompositionRequest {
  readonly width: number;
  readonly height: number;
  readonly video: FootagePicture | null;
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly layers: ReadonlyArray<FootageLayerPicture>;
  readonly grade?: FootageGrade | undefined;
}

/**
 * Composes a frame from the source's picture and the footage layers
 * active over it, each drawn in the state it is given. Implementations
 * agree on one picture for one request, which is what lets two
 * consumers drawing the same layers in the same states show the same
 * frame.
 */
export interface FootageCompositor {
  compose(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FootageCompositionRequest,
  ): void;
}
