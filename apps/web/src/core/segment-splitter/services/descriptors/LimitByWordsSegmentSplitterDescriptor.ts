import { LimitByWordsSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { LimitByWordsSegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

export class LimitByWordsSegmentSplitterDescriptor implements SegmentSplitterDescriptor<LimitByWordsSegmentConfig> {
  readonly type = 'limit_by_words' as const;

  readonly defaultConfig: LimitByWordsSegmentConfig = {
    type: 'limit_by_words',
    maxWords: 6,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'maxWords', label: 'Max words', type: 'integer', default: 6, min: 1, max: 20 },
  ];

  build(config: LimitByWordsSegmentConfig, _context: SegmentSplitterContext): SegmentSplitter {
    return new LimitByWordsSegmentSplitter({ maxWords: config.maxWords });
  }

  toDisplay(config: LimitByWordsSegmentConfig, _context: SegmentSplitterContext): SegmentSplitterDisplay {
    return {
      fields: this.controlsSchema,
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<LimitByWordsSegmentConfig> {
    return { [fieldId]: displayValue } as Partial<LimitByWordsSegmentConfig>;
  }
}
