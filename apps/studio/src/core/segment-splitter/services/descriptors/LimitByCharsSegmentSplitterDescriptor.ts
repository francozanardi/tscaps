import { LimitByCharsSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { LimitByCharsSegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

export class LimitByCharsSegmentSplitterDescriptor implements SegmentSplitterDescriptor<LimitByCharsSegmentConfig> {
  readonly type = 'limit_by_chars' as const;

  readonly defaultConfig: LimitByCharsSegmentConfig = {
    type: 'limit_by_chars',
    maxChars: 35,
    minChars: 0,
    minDuration: 0.25,
    minLastWordDuration: 0,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'maxChars', label: 'Max characters', type: 'integer', default: 35, min: 10, max: 80 },
    { id: 'minChars', label: 'Min characters', type: 'integer', default: 0, min: 0, max: 40 },
    { id: 'minDuration', label: 'Min duration (s)', type: 'float', default: 0.25, min: 0, max: 2, step: 0.05 },
    { id: 'minLastWordDuration', label: 'Min last word duration (s)', type: 'float', default: 0, min: 0, max: 2, step: 0.05 },
  ];

  build(config: LimitByCharsSegmentConfig, _context: SegmentSplitterContext): SegmentSplitter {
    return new LimitByCharsSegmentSplitter({
      maxChars: config.maxChars,
      minChars: config.minChars,
      minDuration: config.minDuration,
      minLastWordDuration: config.minLastWordDuration,
    });
  }

  toDisplay(config: LimitByCharsSegmentConfig, _context: SegmentSplitterContext): SegmentSplitterDisplay {
    return {
      fields: this.controlsSchema,
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<LimitByCharsSegmentConfig> {
    return { [fieldId]: displayValue } as Partial<LimitByCharsSegmentConfig>;
  }
}
