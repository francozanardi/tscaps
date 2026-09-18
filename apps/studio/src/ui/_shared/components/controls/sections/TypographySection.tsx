import { memo, type ReactNode } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { PhysicalSide, TextDirection } from '@tscaps/engine';
import type { TextAlign, TextCase, TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { FontStackField } from '@ui/_shared/components/controls/fields/FontStackField';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { StyleToggles } from '@ui/_shared/components/controls/fields/StyleToggles';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';

interface TypographySectionProps {
  config: TypographyConfig;
  onChange: (patch: Partial<TypographyConfig>) => void;
  /**
   * Reading direction of the captions. It belongs to the sheet rather
   * than to `config` because it describes the language of the text, not
   * a look, and so survives a template switch.
   */
  textDirection: TextDirection;
  /** Screen side the current alignment lands on, so the active button is found whichever vocabulary the value uses. */
  alignedTo: PhysicalSide;
  onTextDirectionChange: (value: TextDirection) => void;
  /** When true, the Section header is omitted (the surrounding tab provides the title). */
  hideTitle?: boolean | undefined;
  /** Control ids whose variable the sheet's own CSS no longer reads. */
  customizedIds?: ReadonlySet<string> | undefined;
  /** Alphabets these captions are written in, the most used first. Never empty. */
  scripts: ReadonlyArray<FontFaceSlot>;
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
// The negative end reaches -0.08 because a heavy face set large and in caps
// wants the letters closer than a text face ever would, and a template
// shipping such a default has to leave the user able to return to it.
const LETTER_SPACING_MIN = -0.08;
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

const TEXT_DIRECTION_OPTIONS: ReadonlyArray<{ value: TextDirection; label: string }> = [
  { value: 'ltr', label: 'Left to right' },
  { value: 'rtl', label: 'Right to left' },
];

interface TextAlignOption {
  value: TextAlign;
  /** Screen side this option produces on a sheet reading in the matching direction. */
  lands: PhysicalSide;
  tooltip: string;
  icon: ReactNode;
}

// The buttons write reading-relative values, so the same three land on
// opposite sides depending on the sheet. The icon and the tooltip name the
// side the reader will actually get, and `lands` is what the current setting
// is compared against — a template may have declared its alignment as a
// screen side, which no reading-relative value equals on the nose.
const TEXT_ALIGN_OPTIONS_BY_DIRECTION: Record<TextDirection, ReadonlyArray<TextAlignOption>> = {
  ltr: [
    { value: 'start', lands: 'left', tooltip: 'Align left', icon: <AlignLeft size={13} /> },
    { value: 'center', lands: 'center', tooltip: 'Align center', icon: <AlignCenter size={13} /> },
    { value: 'end', lands: 'right', tooltip: 'Align right', icon: <AlignRight size={13} /> },
  ],
  rtl: [
    { value: 'start', lands: 'right', tooltip: 'Align right', icon: <AlignRight size={13} /> },
    { value: 'center', lands: 'center', tooltip: 'Align center', icon: <AlignCenter size={13} /> },
    { value: 'end', lands: 'left', tooltip: 'Align left', icon: <AlignLeft size={13} /> },
  ],
};

/**
 * Fixed-shape typography section. Every numeric row reuses the shared
 * `Slider` atom; the Font row is inline because Autocomplete is the only
 * non-slider field.
 */
export const TypographySection = memo(function TypographySection({
  config,
  onChange,
  textDirection,
  alignedTo,
  onTextDirectionChange,
  hideTitle,
  customizedIds,
  scripts,
}: TypographySectionProps) {
  // A control that writes more than one variable counts as taken over
  // only when every one of them is gone. Losing one leaves the rest of
  // the control working, and saying otherwise would be the lie this
  // whole state exists to avoid.
  const customized = (...controlIds: string[]): boolean =>
    customizedIds !== undefined && controlIds.every((id) => customizedIds.has(id));
  return (
    <Section title={hideTitle ? undefined : 'Typography'}>
      <CustomizedFieldOverlay customized={customized('font-family')} label="Font" controlIds={['font-family']}>
        <FontStackField
          label="Font"
          stack={config.fontStack}
          scripts={scripts}
          onChange={(fontStack) => onChange({ fontStack })}
        />
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('font-size')} label="Font size" controlIds={['font-size']}>
        <Slider
          label="Font size"
          value={config.fontSize}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={FONT_SIZE_STEP}
          unit="cqh"
          onChange={(v) => onChange({ fontSize: v })}
        />
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('font-weight')} label="Weight" controlIds={['font-weight']}>
        <Slider
          label="Weight"
          value={config.fontWeight}
          min={FONT_WEIGHT_MIN}
          max={FONT_WEIGHT_MAX}
          step={FONT_WEIGHT_STEP}
          onChange={(v) => onChange({ fontWeight: v })}
        />
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay
        customized={customized('font-style', 'text-decoration')}
        label="Style"
        controlIds={['font-style', 'text-decoration']}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted min-w-[90px] shrink-0">Style</span>
          <StyleToggles
            value={{ italic: config.italic, underline: config.underline, strikethrough: config.strikethrough }}
            onChange={(patch) => onChange(patch)}
          />
        </div>
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('text-align')} label="Align" controlIds={['text-align']}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted min-w-[90px] shrink-0">Align</span>
          <div
            className="flex rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px]"
            role="radiogroup"
            aria-label="Text alignment"
          >
            {TEXT_ALIGN_OPTIONS_BY_DIRECTION[textDirection].map((opt) => {
              const active = alignedTo === opt.lands;
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
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('text-transform')} label="Case" controlIds={['text-transform']}>
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
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('letter-spacing')} label="Letter spacing" controlIds={['letter-spacing']}>
        <Slider
          label="Letter spacing"
          value={config.letterSpacing}
          min={LETTER_SPACING_MIN}
          max={LETTER_SPACING_MAX}
          step={LETTER_SPACING_STEP}
          unit="em"
          onChange={(v) => onChange({ letterSpacing: v })}
        />
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('word-spacing')} label="Word spacing" controlIds={['word-spacing']}>
        <Slider
          label="Word spacing"
          value={config.wordSpacing}
          min={WORD_SPACING_MIN}
          max={WORD_SPACING_MAX}
          step={WORD_SPACING_STEP}
          unit="em"
          onChange={(v) => onChange({ wordSpacing: v })}
        />
      </CustomizedFieldOverlay>

      <CustomizedFieldOverlay customized={customized('line-spacing')} label="Line spacing" controlIds={['line-spacing']}>
        <Slider
          label="Line spacing"
          value={config.lineSpacing}
          min={LINE_SPACING_MIN}
          max={LINE_SPACING_MAX}
          step={LINE_SPACING_STEP}
          unit="em"
          onChange={(v) => onChange({ lineSpacing: v })}
        />
      </CustomizedFieldOverlay>

      <div className="space-y-1">
        <Select
          label="Direction"
          value={textDirection}
          options={TEXT_DIRECTION_OPTIONS}
          onChange={(value) => onTextDirectionChange(value as TextDirection)}
        />
        <p className="text-2xs text-fg-faint m-0 leading-snug pl-[98px]">
          Picked from your transcript. Switch it if your captions read the other way.
        </p>
      </div>
    </Section>
  );
});
