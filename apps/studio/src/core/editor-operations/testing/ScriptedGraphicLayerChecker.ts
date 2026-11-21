import type { GraphicLayerChecker } from '@core/editor-operations/domain/GraphicLayerChecker';
import type { GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';

/** A clean play: opened, something drawn at every time, nothing logged. */
const CLEAN: GraphicCheckReport = {
  opened: true,
  openError: null,
  widthPx: 400,
  heightPx: 200,
  durationSec: 4,
  frames: [],
  messages: [],
  moments: [],
};

/**
 * Plays no graphic: answers the report it was given (a clean play by
 * default), for tests that run where no graphic can play. Records the
 * layers it was asked to check.
 */
export class ScriptedGraphicLayerChecker implements GraphicLayerChecker {
  readonly checkedLayerIds: string[] = [];
  private report: GraphicCheckReport = CLEAN;

  /** Answers `report`, on top of a clean play, from now on. */
  answer(report: Partial<GraphicCheckReport>): void {
    this.report = { ...CLEAN, ...report };
  }

  async check(layerId: string): Promise<GraphicCheckReport> {
    this.checkedLayerIds.push(layerId);
    return this.report;
  }
}
