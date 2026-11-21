import type { FootageCompositionRequest, FootageCompositor } from '@modules/video/FootageCompositor';
import { FootageFraming } from '@modules/video/FootageFraming';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import { CanvasFootagePicture } from '@modules/video/CanvasFootagePicture';
import type { FootageRect } from '@modules/video/FootageRect';
import type { FootageGrader } from '@modules/video/grade/FootageGrader';
import { SourcePicturePlacement } from '@modules/video/SourcePicturePlacement';

const BACKDROP = '#000000';
const WHOLE_FRAME: FootageRect = { x: 0, y: 0, width: 1, height: 1 };

/**
 * {@link FootageCompositor} on a 2D canvas context.
 *
 * The source's picture goes first. Where no layer showing it is active,
 * it is drawn over the whole frame, or, when a layer's state carries a
 * `videoRect` (the topmost such layer wins), re-framed to cover that
 * rect over a black frame. Where one is, the frame is black and the
 * source's picture is drawn by those layers alone, in their own states —
 * each in the `videoRect` instead of its own rect where there is one.
 * Where a layer draws the video over itself instead, the frame starts
 * black too and the video is drawn in its rect right after that layer,
 * its corners rounded.
 *
 * Each layer is then drawn in its state, bottom to top; a backdrop layer
 * takes up the frame drawn so far and draws it again in its state, over
 * its background colour, or black where it has none. A layer that hides
 * the whole frame ({@link FootageOcclusion}) hides everything beneath
 * it, so nothing beneath it is drawn at all. Where the source's picture
 * goes is {@link SourcePicturePlacement}'s to say, which is what a
 * consumer drawing over the result places itself by.
 *
 * The request's grade, if any, grades the picture through `grader` once
 * everything beneath the first backdrop layer is drawn, or once every
 * layer is where there is none: a backdrop draws the graded picture
 * again, as a cut taken from beneath it sees it.
 */
export class CanvasFootageCompositor implements FootageCompositor {
  constructor(private readonly grader: FootageGrader) {}

  compose(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FootageCompositionRequest,
  ): void {
    const placement = new SourcePicturePlacement(request);
    const coveringIndex = placement.wholeFrameCoverIndex();
    const aboveIndex = placement.videoAboveIndex();
    if (coveringIndex === -1) {
      if (aboveIndex === -1 && !placement.isDrawnByLayers()) this.drawVideo(context, request, placement);
      else this.fillBlack(context, request);
    }
    let graded = false;
    request.layers.forEach((entry, index) => {
      if (index < coveringIndex) return;
      if (entry.layer.source.kind === 'backdrop') {
        if (!graded) this.grade(context, request);
        graded = true;
        this.drawBackdrop(context, entry.state, request);
      } else {
        new FootageFraming(placement.stateOf(entry), request.width, request.height)
          .draw(context, entry.picture, entry.width, entry.height);
      }
      if (index === aboveIndex) this.drawVideoAbove(context, entry.state, request);
    });
    if (!graded) this.grade(context, request);
  }

  private grade(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, request: FootageCompositionRequest): void {
    if (request.grade) this.grader.grade(context, request.width, request.height, request.grade);
  }

  /** The source's picture covering the layer's `videoRect`, its corners rounded as the layer says. */
  private drawVideoAbove(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    state: FootageLayerFrameState,
    request: FootageCompositionRequest,
  ): void {
    if (request.video === null || state.videoRect === null) return;
    const placed = SourcePicturePlacement.coverAtRest(state.videoRect, state.videoCornerRadius);
    new FootageFraming(placed, request.width, request.height)
      .draw(context, request.video, request.videoWidth, request.videoHeight);
  }

  /** The frame drawn so far, taken up and drawn again in `state` over its background colour, or black. */
  private drawBackdrop(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    state: FootageLayerFrameState,
    request: FootageCompositionRequest,
  ): void {
    const beneath = new OffscreenCanvas(context.canvas.width, context.canvas.height);
    beneath.getContext('2d')!.drawImage(context.canvas, 0, 0);
    context.save();
    context.fillStyle = state.backgroundColor ?? BACKDROP;
    context.fillRect(0, 0, request.width, request.height);
    context.restore();
    new FootageFraming(state, request.width, request.height)
      .draw(context, new CanvasFootagePicture(beneath), beneath.width, beneath.height);
  }

  private drawVideo(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FootageCompositionRequest,
    placement: SourcePicturePlacement,
  ): void {
    const reframing = placement.videoRect();
    if (reframing !== null) this.fillBlack(context, request);
    if (request.video === null) return;
    new FootageFraming(SourcePicturePlacement.coverAtRest(reframing ?? WHOLE_FRAME), request.width, request.height)
      .draw(context, request.video, request.videoWidth, request.videoHeight);
  }

  private fillBlack(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, request: FootageCompositionRequest): void {
    context.save();
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, request.width, request.height);
    context.restore();
  }
}
