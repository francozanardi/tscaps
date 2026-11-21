import type { GraphicLayerChecker } from '@core/editor-operations/domain/GraphicLayerChecker';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

// Mid-entrance, landed, a moment later, and the end: a scene may come in from nothing, so it is judged where it paints most.
const PLAYED_AT_SECS = [0.35, 1.2, 2.5, 1e6];
// At least this share of its part painted solid, at the moment it paints most, fills it.
const FILLED_SHARE = 0.9;

/**
 * Whether a graphic fills the part of the frame a full or a split layout
 * gives it, as a b-roll does: painted all but solid over nearly all of
 * it, at the moment it paints most. A graphic that leaves most of that
 * part see-through is something set over the video (a title, a number,
 * a sticker): it belongs in an inset box, which a person picks, moves and
 * resizes on the preview, while a full or split layer is laid out by its
 * layout alone, and nothing drawn inside it can be picked.
 */
export class GraphicFillCheck {
  constructor(private readonly checker: GraphicLayerChecker) {}

  /**
   * Plays the graphic of the layer `layerId` once in the box `placement`
   * would give it, the layer left as it is, and answers an error, on
   * `ref`, when it would not fill it. An inset box is never played: a
   * graphic need not fill one.
   */
  async refusalsOf(layerId: string, ref: string, placement: ShotLayerPlacement): Promise<OperationProblem[]> {
    if (placement.kind === 'inset') return [];
    const report = await this.checker.check(layerId, PLAYED_AT_SECS, new AbortController().signal, placement);
    try {
      const shortfall = this.shortfallOf(report, placement.kind);
      if (shortfall === null) return [];
      return [{
        severity: 'error',
        message: `${ref} was left as it was: ${shortfall} A graphic set over the video (a title, a number, a list, a sticker) goes in an inset box, which the person can move and resize: give it an inset layout. To lay it out ${placement.kind}, first paint its whole box (edit_graphic).`,
        ref,
      }];
    } finally {
      for (const frame of report.frames) frame.bitmap?.close();
    }
  }

  /**
   * Why the graphic played in `report`, laid out `kind`, does not fill
   * its part of the frame, as one sentence; null when it does, and for an
   * inset box, which it need not fill.
   */
  shortfallOf(report: GraphicCheckReport, kind: ShotLayerPlacement['kind']): string | null {
    if (kind === 'inset') return null;
    const part = kind === 'full' ? 'the frame' : 'its part of the frame';
    if (!report.opened) return `it could not be played to see whether it fills ${part} (${report.openError ?? 'it did not open'}).`;
    const painted = Math.max(0, ...report.frames.map((frame) => frame.paintedShare));
    if (painted >= FILLED_SHARE) return null;
    return `it paints at most ${Math.round(painted * 100)}% of ${part} solid, and a graphic laid out ${kind} must fill it, as a b-roll does: a scene with a background of its own over all of it.`;
  }
}
