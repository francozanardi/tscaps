import type { SheetMatcherRunResult } from '@core/sheet-matchers/domain/SheetMatcher';
import type { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import type { SelectedSegmentSheetMatcher } from '@core/sheet-matchers/services/SelectedSegmentSheetMatcher';

/** Routes an explicit scene selection to one style sheet in a single matcher run. */
export class AssignSelectedSegmentsSheetAction {
  constructor(
    private readonly runMatcher: RunSheetMatcherAction,
    private readonly matcher: SelectedSegmentSheetMatcher,
  ) {}

  execute(sheetId: string, segmentIds: ReadonlySet<string>): SheetMatcherRunResult {
    return this.runMatcher.execute(sheetId, this.matcher, segmentIds);
  }
}
