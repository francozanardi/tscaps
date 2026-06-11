import { SpeakerChangeSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { SpeakerChangeSegmentSplitterConfig } from '@core/segment-splitter/domain/SpeakerChangeSegmentSplitterConfig';

const CONTROLS: readonly ControlField[] = [
  {
    id: 'enabled',
    label: 'Split scenes by speaker',
    type: 'toggle',
    default: false,
    legend: 'Cuts a scene wherever the speaker changes, so each scene carries a single voice.',
  },
];

export class SpeakerChangeSegmentSplitterDescriptor implements SegmentSplitterDescriptor<SpeakerChangeSegmentSplitterConfig> {
  readonly type = 'speaker_change' as const;

  readonly defaultConfig: SpeakerChangeSegmentSplitterConfig = {
    type: 'speaker_change',
    enabled: false,
  };

  readonly controlsSchema: readonly ControlField[] = CONTROLS;

  build(config: SpeakerChangeSegmentSplitterConfig, _context: SegmentSplitterContext): SegmentSplitter {
    return new SpeakerChangeSegmentSplitter(config.enabled);
  }

  toDisplay(config: SpeakerChangeSegmentSplitterConfig, _context: SegmentSplitterContext): SegmentSplitterDisplay {
    return {
      fields: this.controlsSchema,
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<SpeakerChangeSegmentSplitterConfig> {
    return { [fieldId]: displayValue } as Partial<SpeakerChangeSegmentSplitterConfig>;
  }
}
