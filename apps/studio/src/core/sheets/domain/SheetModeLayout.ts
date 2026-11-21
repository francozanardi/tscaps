import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { TemplateTagName } from '@core/tagging/domain/TagName';

/**
 * How a sheet cuts and breaks the captions of one of its template's
 * modes: the template's layout for that mode, as the person has edited
 * it. The body's layout is the sheet's own `segmentSplitterConfigs` and
 * `lineSplitterConfig`.
 */
export interface SheetModeLayout {
  readonly tag: TemplateTagName;
  readonly segmentSplitterConfigs: readonly SegmentSplitterConfig[];
  readonly lineSplitterConfig: LineSplitterConfig;
}
