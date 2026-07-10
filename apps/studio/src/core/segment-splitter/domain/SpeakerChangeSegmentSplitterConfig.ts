import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

export interface SpeakerChangeSegmentSplitterConfig extends SegmentSplitterConfig {
  readonly type: 'speaker_change';
  readonly enabled: boolean;
}
