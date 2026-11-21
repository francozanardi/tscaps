import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

/** The pipeline that cuts the captions whose words carry `tag`. */
export interface TaggedSegmentPipeline {
  readonly tag: string;
  readonly segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
}
