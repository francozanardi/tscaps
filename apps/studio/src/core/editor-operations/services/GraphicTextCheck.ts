import type { GraphicCheckFrame, GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';

// Entrances run 0.3 to 0.6 s and exits are shorter: text measured from here to this long before the end has landed.
const LANDED_AFTER_SEC = 1;
const EXIT_ALLOWANCE_SEC = 0.8;
// The least text size that reads on a phone, as a share of the frame's short side (28 px on 1080 x 1920).
const READABLE_SHARE = 0.026;

/**
 * Reads, from a graphic played to be checked, what keeps its text from
 * reading once it has landed: text cut by its box or by an element that
 * clips it, and text under the least size that reads on a phone. Frames
 * caught mid-entrance or mid-exit are not judged, since text moving in
 * from outside its box is not cut. Answers sentences for the model, none
 * when nothing is wrong or no text could be measured.
 */
export class GraphicTextCheck {
  /** `frameShortSidePx` is the output frame's shorter side, in the pixels the box was drawn in. */
  problemsOf(report: GraphicCheckReport, frameShortSidePx: number): string[] {
    const landed = this.landedFrames(report);
    if (landed.length === 0) return [];
    return [...this.cutOf(landed), ...this.smallOf(landed, frameShortSidePx)];
  }

  /** The frames measured once the graphic has landed; the one nearest its middle when it is too short to have any. */
  private landedFrames(report: GraphicCheckReport): GraphicCheckFrame[] {
    const measured = report.frames.filter((frame) => frame.text !== null);
    const landed = measured.filter((frame) => frame.sec >= LANDED_AFTER_SEC && frame.sec <= report.durationSec - EXIT_ALLOWANCE_SEC);
    if (landed.length > 0 || measured.length === 0) return landed;
    const middle = report.durationSec / 2;
    return [measured.reduce((nearest, frame) => (Math.abs(frame.sec - middle) < Math.abs(nearest.sec - middle) ? frame : nearest))];
  }

  private cutOf(frames: ReadonlyArray<GraphicCheckFrame>): string[] {
    const cutFrames = frames.filter((frame) => (frame.text?.cut.length ?? 0) > 0);
    if (cutFrames.length === 0) return [];
    const texts = [...new Set(cutFrames.flatMap((frame) => frame.text?.cut ?? []))].map((text) => `"${text}"`).join(', ');
    const times = cutFrames.map((frame) => `${frame.sec.toFixed(2)} s`).join(', ');
    return [`Once landed (at ${times} after it appears), text is cut by its box or by an element that clips it: ${texts}. Give it room: more padding, a wider aspectRatio, or smaller type.`];
  }

  private smallOf(frames: ReadonlyArray<GraphicCheckFrame>, frameShortSidePx: number): string[] {
    const sizes = frames.flatMap((frame) => (frame.text?.smallest === null || frame.text === null ? [] : [frame.text.smallest]));
    if (sizes.length === 0 || frameShortSidePx <= 0) return [];
    const smallest = sizes.reduce((least, size) => (size.px < least.px ? size : least));
    const readablePx = Math.round(frameShortSidePx * READABLE_SHARE);
    if (smallest.px >= readablePx) return [];
    return [`Its smallest text once landed, "${smallest.text}", is ${Math.round(smallest.px)} px, under the least that reads on a phone (${readablePx} px on this frame). Make it bigger, unless the person asked for it this small.`];
  }
}
