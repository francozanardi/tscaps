import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

export interface CueChangeSegmentSplitterConfig extends SegmentSplitterConfig {
  readonly type: 'cue_change';
  readonly enabled: boolean;
}
