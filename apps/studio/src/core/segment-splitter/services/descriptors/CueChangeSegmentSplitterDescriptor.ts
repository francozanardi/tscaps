import { CueChangeSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { CueChangeSegmentSplitterConfig } from '@core/segment-splitter/domain/CueChangeSegmentSplitterConfig';

const CONTROLS: readonly ControlField[] = [
  {
    id: 'enabled',
    label: 'Split scenes by subtitle line',
    type: 'toggle',
    default: true,
    legend: 'Never puts two lines of your subtitle file in the same scene.',
  },
];

/**
 * Keeps the cues of an imported caption file apart. On by default
 * everywhere, since it cuts nothing in a document whose words carry no
 * cue; for the same reason its control is offered only when the
 * document has cues, so a transcribed project never shows a toggle
 * that would do nothing.
 */
export class CueChangeSegmentSplitterDescriptor implements SegmentSplitterDescriptor<CueChangeSegmentSplitterConfig> {
  readonly type = 'cue_change' as const;

  readonly defaultConfig: CueChangeSegmentSplitterConfig = {
    type: 'cue_change',
    enabled: true,
  };

  readonly controlsSchema: readonly ControlField[] = CONTROLS;

  build(config: CueChangeSegmentSplitterConfig, _context: SegmentSplitterContext): SegmentSplitter {
    return new CueChangeSegmentSplitter(config.enabled);
  }

  toDisplay(config: CueChangeSegmentSplitterConfig, context: SegmentSplitterContext): SegmentSplitterDisplay {
    return {
      fields: context.documentHasCues ? this.controlsSchema : [],
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<CueChangeSegmentSplitterConfig> {
    return { [fieldId]: displayValue } as Partial<CueChangeSegmentSplitterConfig>;
  }
}
