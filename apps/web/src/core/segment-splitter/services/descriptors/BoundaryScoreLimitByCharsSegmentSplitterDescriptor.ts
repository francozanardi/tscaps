import { BoundaryScoreLimitByCharsSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { BoundaryScoreLimitByCharsSegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

/**
 * Character-limit splitter that prefers cuts where words carry a high
 * `boundaryScore`. Falls back to greedy behaviour when the words in the
 * valid cut range have no score set.
 */
export class BoundaryScoreLimitByCharsSegmentSplitterDescriptor
  implements SegmentSplitterDescriptor<BoundaryScoreLimitByCharsSegmentConfig>
{
  readonly type = 'boundary_score_limit_by_chars' as const;

  readonly defaultConfig: BoundaryScoreLimitByCharsSegmentConfig = {
    type: 'boundary_score_limit_by_chars',
    maxChars: 40,
    minChars: 0,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'maxChars', label: 'Max letters', type: 'integer', default: 40, min: 1, max: 120 },
    { id: 'minChars', label: 'Min letters', type: 'integer', default: 0, min: 0, max: 60 },
  ];

  build(
    config: BoundaryScoreLimitByCharsSegmentConfig,
    _context: SegmentSplitterContext,
  ): SegmentSplitter {
    return new BoundaryScoreLimitByCharsSegmentSplitter({
      maxChars: config.maxChars,
      minChars: config.minChars,
    });
  }

  toDisplay(
    config: BoundaryScoreLimitByCharsSegmentConfig,
    _context: SegmentSplitterContext,
  ): SegmentSplitterDisplay {
    return {
      fields: this.controlsSchema,
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<BoundaryScoreLimitByCharsSegmentConfig> {
    return { [fieldId]: displayValue } as Partial<BoundaryScoreLimitByCharsSegmentConfig>;
  }
}
