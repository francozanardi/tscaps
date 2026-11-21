import type { FootageCompositionRequest, FootageLayerPicture } from '@modules/video/FootageCompositor';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import { FootageOcclusion } from '@modules/video/FootageOcclusion';
import type { FootageRect } from '@modules/video/FootageRect';

const CENTRED = { share: 0.5, offset: 0 };
const WHOLE_FRAME: FootageRect = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Where the source's own picture lands on a composed frame: the state it
 * is drawn in, on a frame of `frameWidth × frameHeight`, from a picture
 * of `pictureWidth × pictureHeight`. Drawing anything measured on the
 * source's picture — a mask, a box — with a {@link FootageFraming} of
 * that state puts it where the picture shows it.
 */
export interface PlacedSourcePicture {
  readonly state: FootageLayerFrameState;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly pictureWidth: number;
  readonly pictureHeight: number;
}

/**
 * How one composition draws the source's own picture, which every
 * compositor and every consumer of its frames must agree on.
 *
 * Where no layer showing the source's picture is active, it covers the
 * whole frame, centred, or the `videoRect` of the topmost layer carrying
 * one. Where some are, the frame is black beneath them and they draw it,
 * each in its own state — in that `videoRect` instead of its own rect
 * where there is one. Where a layer draws the video over itself
 * (`videoAbove`), the frame is black beneath every layer too and the
 * topmost such layer draws it in its `videoRect`, its corners rounded. A
 * layer that hides the whole frame ({@link FootageOcclusion}) hides
 * everything beneath it.
 */
export class SourcePicturePlacement {
  /** The source's picture covering a frame of its own shape, centred and at rest: a frame no layer changes. */
  static asIs(frameWidth: number, frameHeight: number, pictureWidth: number, pictureHeight: number): PlacedSourcePicture {
    return { state: SourcePicturePlacement.coverAtRest(WHOLE_FRAME), frameWidth, frameHeight, pictureWidth, pictureHeight };
  }

  /** The source's picture covering `rect`, centred and unmoved, its corners rounded by `cornerRadius`. */
  static coverAtRest(rect: FootageRect, cornerRadius = 0): FootageLayerFrameState {
    return {
      assetRect: rect,
      fit: 'cover',
      position: { x: CENTRED, y: CENTRED },
      cornerRadius,
      opacity: 1,
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      blur: 0,
      brightness: 1,
      backgroundColor: null,
      fillBlur: 0,
      clipRect: null,
      clipRadius: 0,
      clipInset: { top: 0, right: 0, bottom: 0, left: 0 },
      videoRect: null,
      videoAbove: false,
      videoCornerRadius: 0,
    };
  }

  constructor(private readonly request: FootageCompositionRequest) {}

  /** The index of the topmost layer hiding the whole frame, or -1 when none does and the video shows beneath them all. */
  wholeFrameCoverIndex(): number {
    for (let index = this.request.layers.length - 1; index >= 0; index--) {
      if (this.hidesWholeFrame(this.request.layers[index]!)) return index;
    }
    return -1;
  }

  /** The `videoRect` of the topmost layer carrying one, or null. */
  videoRect(): FootageRect | null {
    for (let index = this.request.layers.length - 1; index >= 0; index--) {
      const videoRect = this.request.layers[index]!.state.videoRect;
      if (videoRect !== null) return videoRect;
    }
    return null;
  }

  /** The topmost layer drawing the video over itself in its `videoRect`, or -1 where none does. */
  videoAboveIndex(): number {
    for (let index = this.request.layers.length - 1; index >= 0; index--) {
      if (this.drawsVideoAbove(this.request.layers[index]!)) return index;
    }
    return -1;
  }

  /** Whether some active layer draws the source's picture, so nothing draws it beneath them. */
  isDrawnByLayers(): boolean {
    return this.request.layers.some((entry) => entry.layer.source.kind === 'source-picture');
  }

  /** The state `entry` is drawn in: its own, or for a layer showing the source's picture, re-framed into the `videoRect` where there is one. */
  stateOf(entry: FootageLayerPicture): FootageLayerFrameState {
    const videoRect = this.videoRect();
    return entry.layer.source.kind === 'source-picture' && videoRect !== null
      ? { ...entry.state, assetRect: videoRect }
      : entry.state;
  }

  /**
   * Where the source's picture lands on top: the topmost layer showing
   * it or drawing it over itself, or the cover beneath every layer where
   * none does. Null where a layer above it hides the whole frame, so it
   * shows nowhere.
   */
  placed(): PlacedSourcePicture | null {
    const covering = this.wholeFrameCoverIndex();
    const sized = (state: FootageLayerFrameState): PlacedSourcePicture => ({
      state,
      frameWidth: this.request.width,
      frameHeight: this.request.height,
      pictureWidth: this.request.videoWidth,
      pictureHeight: this.request.videoHeight,
    });
    for (let index = this.request.layers.length - 1; index >= 0; index--) {
      const entry = this.request.layers[index]!;
      const shows = entry.layer.source.kind === 'source-picture' || this.drawsVideoAbove(entry);
      if (!shows) continue;
      if (index < covering) return null;
      return entry.layer.source.kind === 'source-picture'
        ? sized(this.stateOf(entry))
        : sized(SourcePicturePlacement.coverAtRest(entry.state.videoRect!, entry.state.videoCornerRadius));
    }
    return covering === -1 ? sized(SourcePicturePlacement.coverAtRest(this.videoRect() ?? WHOLE_FRAME)) : null;
  }

  private drawsVideoAbove(entry: FootageLayerPicture): boolean {
    return entry.state.videoAbove && entry.state.videoRect !== null;
  }

  /** A layer showing the source's picture inside a `videoRect` covers only that rect. */
  private hidesWholeFrame(entry: FootageLayerPicture): boolean {
    if (entry.layer.source.kind === 'source-picture' && this.videoRect() !== null) return false;
    return new FootageOcclusion(entry.layer.source.kind, entry.state).hidesWholeFrame(this.request.width, this.request.height);
  }
}
