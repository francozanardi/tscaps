import type { EditorStore } from '@core/editor/store/EditorStore';
import type { GraphicLayerChecker } from '@core/editor-operations/domain/GraphicLayerChecker';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { GraphicFillCheck } from '@core/editor-operations/services/GraphicFillCheck';
import type { GraphicTextCheck } from '@core/editor-operations/services/GraphicTextCheck';
import type { GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

// The start of an entrance, its middle, landed, a moment later, and the end (clamped to the graphic's length).
const PLAYED_AT_SECS = [0.1, 0.35, 1.2, 2.5, 1e6];
// Below this share of drawn pixels a picture reads as empty.
const EMPTY_SHARE = 0.002;
const MAX_ERRORS_LISTED = 5;
const MAX_ERROR_CHARS = 300;

/**
 * Plays a graphic layer once, alone at its box size, after its code
 * changed, and answers what went wrong as warnings: the code did not
 * open, it threw or logged errors, it drew nothing at all, or, laid out
 * over the whole frame or a split part of it, it does not fill that part
 * ({@link GraphicFillCheck}); or, once landed, its text is cut or too
 * small to read ({@link GraphicTextCheck}). Static reading cannot find these; the
 * graphic is in the project either way, so they never refuse the change.
 * A graphic that played cleanly answers no problem.
 */
export class GraphicPlaybackCheck {
  constructor(
    private readonly store: EditorStore,
    private readonly checker: GraphicLayerChecker,
    private readonly fill: GraphicFillCheck,
    private readonly text: GraphicTextCheck,
  ) {}

  async problemsOf(layerId: string, ref: string): Promise<OperationProblem[]> {
    const report = await this.checker.check(layerId, PLAYED_AT_SECS, new AbortController().signal);
    try {
      const placement = this.store.snapshot().shots.placementOf(layerId);
      return this.readingOf(report, placement).map((message) => ({ severity: 'warning', message, ref }));
    } finally {
      for (const frame of report.frames) frame.bitmap?.close();
    }
  }

  private readingOf(report: GraphicCheckReport, placement: ShotLayerPlacement): string[] {
    if (!report.opened) return [`Its code failed when played: ${report.openError ?? 'it did not open'}. Fix it with edit_graphic.`];
    const emptiness = this.emptinessOf(report);
    // A graphic that drew nothing is told so once, not also that it fills nothing.
    if (emptiness.length > 0) return [...this.errorsOf(report), ...emptiness];
    return [...this.errorsOf(report), ...this.fillOf(report, placement), ...this.text.problemsOf(report, this.frameShortSidePx())];
  }

  /** The output frame's shorter side in pixels, 0 before the project has a frame. */
  private frameShortSidePx(): number {
    const frame = this.store.snapshot().frameLayout;
    return frame === null ? 0 : Math.min(frame.width, frame.height);
  }

  private fillOf(report: GraphicCheckReport, placement: ShotLayerPlacement): string[] {
    const shortfall = this.fill.shortfallOf(report, placement.kind);
    if (shortfall === null) return [];
    return [`Laid out ${placement.kind}, ${shortfall} The video shows through the rest, and the person cannot pick it on the preview to move or resize it. If it sits over the video rather than in place of it, move it into an inset box (set_layer); otherwise paint its whole box.`];
  }

  private errorsOf(report: GraphicCheckReport): string[] {
    const errors = report.messages.filter((message) => message.level === 'error');
    const failedFrames = report.frames.filter((frame) => frame.error !== null);
    // The same error thrown on every frame is one problem; its stack says nothing the model can act on.
    const lines = [...new Set([
      ...errors.map((message) => this.firstLineOf(message.text)),
      ...failedFrames.map((frame) => this.firstLineOf(frame.error ?? '')),
    ])];
    if (lines.length === 0) return [];
    const more = lines.length > MAX_ERRORS_LISTED ? ` (and ${lines.length - MAX_ERRORS_LISTED} more)` : '';
    return [`Its code threw when played: ${lines.slice(0, MAX_ERRORS_LISTED).join(' | ')}${more}. Fix it with edit_graphic.`];
  }

  private firstLineOf(text: string): string {
    return text.split('\n', 1)[0]!.trim().slice(0, MAX_ERROR_CHARS);
  }

  private emptinessOf(report: GraphicCheckReport): string[] {
    const drawn = report.frames.filter((frame) => frame.bitmap !== null);
    if (drawn.length === 0 || drawn.some((frame) => frame.drawnShare >= EMPTY_SHARE)) return [];
    const times = drawn.map((frame) => `${frame.sec.toFixed(2)} s`).join(', ');
    return [`It drew nothing when played (at ${times} after it appears): check that tscaps.render draws, and that its colours show on the video.`];
  }
}
