import { LimitByScaledCharsSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { LimitByScaledCharsSegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

/**
 * Descriptor for the size-aware character limit. `maxChars`/`minChars` are
 * authored against the template's default font-size; the actual cut
 * shrinks proportionally as the active font-size deviates from that
 * baseline, so the "letters per scene" the author chose stays meaningful
 * regardless of how big the subtitles end up rendering.
 *
 * `toDisplay`/`fromDisplay` project the stored config through the active
 * scale so the value exposed for editing matches the effective letters at
 * the current font-size; the raw stored values stay font-agnostic.
 */
export class LimitByScaledCharsSegmentSplitterDescriptor
  implements SegmentSplitterDescriptor<LimitByScaledCharsSegmentConfig>
{
  readonly type = 'limit_by_scaled_chars' as const;

  readonly defaultConfig: LimitByScaledCharsSegmentConfig = {
    type: 'limit_by_scaled_chars',
    maxChars: 40,
    minChars: 0,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'maxChars', label: 'Max letters', type: 'integer', default: 40, min: 1, max: 120 },
    { id: 'minChars', label: 'Min letters', type: 'integer', default: 0, min: 0, max: 60 },
  ];

  build(config: LimitByScaledCharsSegmentConfig, context: SegmentSplitterContext): SegmentSplitter {
    return new LimitByScaledCharsSegmentSplitter({
      maxChars: config.maxChars,
      minChars: config.minChars,
      scale: this.scale(context),
    });
  }

  toDisplay(config: LimitByScaledCharsSegmentConfig, context: SegmentSplitterContext): SegmentSplitterDisplay {
    const scale = this.scale(context);
    const fields = this.controlsSchema.map((field) => this.scaleFieldBounds(field, scale));
    return {
      fields,
      values: {
        maxChars: Math.round(config.maxChars / scale),
        minChars: Math.round(config.minChars / scale),
      },
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    context: SegmentSplitterContext,
  ): Partial<LimitByScaledCharsSegmentConfig> {
    if (typeof displayValue !== 'number') return {};
    const scale = this.scale(context);
    return { [fieldId]: displayValue * scale } as Partial<LimitByScaledCharsSegmentConfig>;
  }

  // Fixed at 1 for now: scaling the letter budget with font-size couples two
  // distinct user intents (legibility vs. scene pacing) and makes a font-size
  // tweak silently reflow every scene. Kept as a hook so a future opt-in
  // can restore `context.fontSize / context.referenceFontSize` without
  // touching the persisted config.
  private scale(_context: SegmentSplitterContext): number {
    return 1;
  }

  private scaleFieldBounds(field: ControlField, scale: number): ControlField {
    const scaled: ControlField = {
      ...field,
      default: typeof field.default === 'number' ? Math.round((field.default as number) / scale) : field.default,
    };
    if (field.min !== undefined) (scaled as { min: number }).min = Math.round(field.min / scale);
    if (field.max !== undefined) (scaled as { max: number }).max = Math.round(field.max / scale);
    return scaled;
  }
}
