import { PauseBasedSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { PauseBasedSegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

/**
 * Descriptor for the pause-based segment splitter. Cuts segments wherever
 * the gap between consecutive words exceeds `minGap` seconds — the coarsest
 * pre-stage in the splitting pipeline.
 *
 * `controlsSchema` is intentionally empty: this is a template-authoring
 * concern, not an end-user knob.
 */
export class PauseBasedSegmentSplitterDescriptor implements SegmentSplitterDescriptor<PauseBasedSegmentConfig> {
  readonly type = 'pause_based' as const;

  readonly defaultConfig: PauseBasedSegmentConfig = {
    type: 'pause_based',
    minGap: 0.5,
  };

  readonly controlsSchema: readonly ControlField[] = [];

  build(config: PauseBasedSegmentConfig, _context: SegmentSplitterContext): SegmentSplitter {
    return new PauseBasedSegmentSplitter({ minGap: config.minGap });
  }

  toDisplay(config: PauseBasedSegmentConfig, _context: SegmentSplitterContext): SegmentSplitterDisplay {
    return {
      fields: this.controlsSchema,
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<PauseBasedSegmentConfig> {
    return { [fieldId]: displayValue } as Partial<PauseBasedSegmentConfig>;
  }
}
