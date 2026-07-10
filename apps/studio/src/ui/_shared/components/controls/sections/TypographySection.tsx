import { memo, type ReactNode } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { TextAlign, TextCase, TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import { FontPicker } from '@ui/_shared/components/controls/fields/FontPicker';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { StyleToggles } from '@ui/_shared/components/controls/fields/StyleToggles';

interface TypographySectionProps {
  config: TypographyConfig;
  onChange: (patch: Partial<TypographyConfig>) => void;
  /** When true, the Section header is omitted (the surrounding tab provides the title). */
  hideTitle?: boolean | undefined;
}

// Font size in `cqh` (percent of video height); spacing in `em` (relative
// to current font-size). The upper bound is intentionally generous (a
// caption occupying up to ~25% of vertical space) so the user can author
// emphasis scenes without hitting a ceiling; protection against overflow
// is a UI responsibility, not a slider one. Range covers roughly
// 13px–320px on a 720×1280 vertical reference.
const FONT_SIZE_MIN = 1;
const FONT_SIZE_MAX = 25;
const FONT_SIZE_STEP = 0.1;
const FONT_WEIGHT_MIN = 100;
const FONT_WEIGHT_MAX = 900;
const FONT_WEIGHT_STEP = 100;
const LETTER_SPACING_MIN = -0.05;
const LETTER_SPACING_MAX = 0.2;
const LETTER_SPACING_STEP = 0.005;
const WORD_SPACING_MIN = -0.5;
const WORD_SPACING_MAX = 0.5;
const WORD_SPACING_STEP = 0.01;
const LINE_SPACING_MIN = -0.5;
const LINE_SPACING_MAX = 1.5;
const LINE_SPACING_STEP = 0.01;

// Segmented option labels are tiny case mnemonics rather than icons so the
// button itself shows the visual outcome at a glance.
const TEXT_CASE_OPTIONS: ReadonlyArray<{ value: TextCase; label: string; tooltip: string }> = [
  { value: 'none', label: 'aA', tooltip: 'Original' },
  { value: 'uppercase', label: 'AA', tooltip: 'UPPERCASE' },
  { value: 'lowercase', label: 'aa', tooltip: 'lowercase' },
];

const TEXT_ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; tooltip: string; icon: ReactNode }> = [
  { value: 'left', tooltip: 'Align left', icon: <AlignLeft size={13} /> },
  { value: 'center', tooltip: 'Align center', icon: <AlignCenter size={13} /> },
  { value: 'right', tooltip: 'Align right', icon: <AlignRight size={13} /> },
];

/**
 * Fixed-shape typography section. Every numeric row reuses the shared
 * `Slider` atom; the Font row is inline because Autocomplete is the only
 * non-slider field.
 */
export const TypographySection = memo(function TypographySection({
  config,
  onChange,
  hideTitle,
}: TypographySectionProps) {
  return (
    <Section title={hideTitle ? undefined : 'Typography'}>
      <div className="flex items-start gap-2">
        <span className="text-xs text-fg-muted min-w-[90px] shrink-0 pt-[5px]">Font</span>
        <FontPicker
          value={config.fontFamily}
          onChange={(v) => onChange({ fontFamily: v })}
        />
      </div>

      <Slider
        label="Font size"
        value={config.fontSize}
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={FONT_SIZE_STEP}
        unit="cqh"
        onChange={(v) => onChange({ fontSize: v })}
      />

      <Slider
        label="Weight"
        value={config.fontWeight}
        min={FONT_WEIGHT_MIN}
        max={FONT_WEIGHT_MAX}
        step={FONT_WEIGHT_STEP}
        onChange={(v) => onChange({ fontWeight: v })}
      />

      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted min-w-[90px] shrink-0">Style</span>
        <StyleToggles
          value={{ italic: config.italic, underline: config.underline, strikethrough: config.strikethrough }}
          onChange={(patch) => onChange(patch)}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted min-w-[90px] shrink-0">Align</span>
        <div
          className="flex rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px]"
          role="radiogroup"
          aria-label="Text alignment"
        >
          {TEXT_ALIGN_OPTIONS.map((opt) => {
            const active = config.textAlign === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={opt.tooltip}
                className={
                  active
                    ? 'flex items-center justify-center w-7 h-6 rounded-xs cursor-pointer transition-colors duration-quick ease-standard bg-accent/20 text-fg-primary border border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
                    : 'flex items-center justify-center w-7 h-6 rounded-xs cursor-pointer transition-colors duration-quick ease-standard bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:ring-2 focus-visible:ring-accent/30'
                }
                onClick={() => onChange({ textAlign: opt.value })}
              >
                {opt.icon}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted min-w-[90px] shrink-0">Case</span>
        <div
          className="flex rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px]"
          role="radiogroup"
          aria-label="Text case"
        >
          {TEXT_CASE_OPTIONS.map((opt) => {
            const active = config.textCase === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={opt.tooltip}
                className={
                  active
                    ? 'px-2.5 py-1 rounded-xs text-xs font-mono cursor-pointer transition-colors duration-quick ease-standard bg-accent/20 text-fg-primary border border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
                    : 'px-2.5 py-1 rounded-xs text-xs font-mono cursor-pointer transition-colors duration-quick ease-standard bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:ring-2 focus-visible:ring-accent/30'
                }
                onClick={() => onChange({ textCase: opt.value })}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <Slider
        label="Letter spacing"
        value={config.letterSpacing}
        min={LETTER_SPACING_MIN}
        max={LETTER_SPACING_MAX}
        step={LETTER_SPACING_STEP}
        unit="em"
        onChange={(v) => onChange({ letterSpacing: v })}
      />

      <Slider
        label="Word spacing"
        value={config.wordSpacing}
        min={WORD_SPACING_MIN}
        max={WORD_SPACING_MAX}
        step={WORD_SPACING_STEP}
        unit="em"
        onChange={(v) => onChange({ wordSpacing: v })}
      />

      <Slider
        label="Line spacing"
        value={config.lineSpacing}
        min={LINE_SPACING_MIN}
        max={LINE_SPACING_MAX}
        step={LINE_SPACING_STEP}
        unit="em"
        onChange={(v) => onChange({ lineSpacing: v })}
      />
    </Section>
  );
});
