import { BoundarySegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue, SelectOption } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { BoundaryPreset, BoundarySegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

const PRESET_CHARS: Record<BoundaryPreset, readonly string[]> = {
  none: [],
  sentence: ['.', '?', '!', '...', '."', '?"', '!"', '..."'],
  clause: ['.', '?', '!', '...', ',', ';', ':', '."', '?"', '!"', '..."', ',"', ';"', ':"'],
};

const PRESET_OPTIONS: readonly SelectOption[] = [
  { value: 'none', label: 'Off' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'clause', label: 'Clause' },
];

const CUSTOM_OPTION: SelectOption = { value: 'custom', label: 'Custom' };

const LEGEND_BY_MODE: Record<BoundarySegmentConfig['mode'], string | undefined> = {
  none: undefined,
  sentence: 'Splits at the end of each sentence.',
  clause: 'Splits at sentence endings and at commas, semicolons, and colons.',
  custom: 'This template uses custom boundary characters. Picking another option will replace them.',
};

/**
 * Descriptor for the boundary segment splitter. Resolves preset modes
 * (sentence/clause) to their underlying char lists at build time; `custom`
 * mode can extend any preset to add chars on top without re-listing it.
 *
 * The end-user knob is a select with three presets — off / sentence /
 * clause. A template authored in `custom` mode appears with an extra
 * "Custom" option preserved while it's the active value; once the user
 * picks any preset, the custom char list is no longer applied and the
 * option disappears from the dropdown.
 */
export class BoundarySegmentSplitterDescriptor implements SegmentSplitterDescriptor<BoundarySegmentConfig> {
  readonly type = 'boundary' as const;

  readonly defaultConfig: BoundarySegmentConfig = { type: 'boundary', mode: 'sentence' };

  readonly controlsSchema: readonly ControlField[] = [
    {
      id: 'mode',
      label: 'Split scenes by',
      type: 'select',
      default: 'sentence',
      options: PRESET_OPTIONS,
    },
  ];

  build(config: BoundarySegmentConfig, _context: SegmentSplitterContext): SegmentSplitter {
    return new BoundarySegmentSplitter({ separators: this.resolveChars(config) });
  }

  toDisplay(config: BoundarySegmentConfig, _context: SegmentSplitterContext): SegmentSplitterDisplay {
    const options = config.mode === 'custom' ? [...PRESET_OPTIONS, CUSTOM_OPTION] : PRESET_OPTIONS;
    const legend = LEGEND_BY_MODE[config.mode];
    const field: ControlField = { ...this.controlsSchema[0]!, options, ...(legend !== undefined && { legend }) };
    return { fields: [field], values: { mode: config.mode } };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<BoundarySegmentConfig> {
    // 'custom' is preserved as a display-only option for templates that
    // authored it; re-selecting it from the dropdown is a no-op since the
    // existing char list is what makes it meaningful.
    if (fieldId === 'mode' && displayValue !== 'custom') {
      return { mode: displayValue as BoundaryPreset } as Partial<BoundarySegmentConfig>;
    }
    return {};
  }

  private resolveChars(config: BoundarySegmentConfig): string[] {
    if (config.mode === 'custom') {
      const base = PRESET_CHARS[config.extends ?? 'none'];
      return [...base, ...config.chars];
    }
    return [...PRESET_CHARS[config.mode]];
  }
}
