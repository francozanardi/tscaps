import { memo } from 'react';
import type {
  GapFreeEffectConfig,
  RemovePunctuationEffectConfig,
  SmartPunctuationEffectConfig,
  SmartLowercaseEffectConfig,
  CarryQuotesEffectConfig,
  EmojiEffectConfig,
  EmojiPlacement,
} from '@core/effect/domain/EffectConfig';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

const EMOJI_PLACEMENT_OPTIONS: ReadonlyArray<{ value: EmojiPlacement; label: string }> = [
  { value: 'segment-below', label: 'Below the caption' },
  { value: 'segment-above', label: 'Above the caption' },
  { value: 'word', label: 'Inline with word' },
];


interface EffectsTabProps {
  sheetScope: SheetScope;
}

export const EffectsTab = memo(function EffectsTab({ sheetScope }: EffectsTabProps) {
  const { effects } = useEngine();
  const sheets = useSheets();
  const sheet = sheetScope.activeSheet;

  // Fall back to the registry default when a sheet was serialized before
  // this effect existed — keeps the toggle rendering a sensible state.
  const gapFree = sheet.effectConfig('gap_free')
    ?? (effects.get('gap_free').defaultConfig as GapFreeEffectConfig);
  const removePunctuation = sheet.effectConfig('remove_punctuation')
    ?? (effects.get('remove_punctuation').defaultConfig as RemovePunctuationEffectConfig);
  const smartPunctuation = sheet.effectConfig('smart_punctuation')
    ?? (effects.get('smart_punctuation').defaultConfig as SmartPunctuationEffectConfig);
  const smartLowercase = sheet.effectConfig('smart_lowercase')
    ?? (effects.get('smart_lowercase').defaultConfig as SmartLowercaseEffectConfig);
  const carryQuotes = sheet.effectConfig('carry_quotes')
    ?? (effects.get('carry_quotes').defaultConfig as CarryQuotesEffectConfig);
  const emoji = sheet.effectConfig('emoji')
    ?? (effects.get('emoji').defaultConfig as EmojiEffectConfig);

  return (
    <EditorTab
      title="Effects"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('effects')}
    >
      <Section>
        <div className="flex flex-col gap-1">
          <Toggle
            label="Gap-free"
            value={gapFree.enabled}
            onChange={(v) => sheets.actions.style.updateEffects.execute({ ...gapFree, enabled: v })}
          />
          <p className="text-2xs text-fg-faint leading-snug m-0">
            Keeps each caption on screen until the next one starts, hiding short pauses between them.
          </p>
        </div>
        <Toggle
          label="Remove punctuation"
          value={removePunctuation.enabled}
          onChange={(v) => sheets.actions.style.updateEffects.execute({ ...removePunctuation, enabled: v })}
        />
        <div className="flex flex-col gap-1">
          <Toggle
            label="Smart punctuation"
            value={smartPunctuation.enabled}
            onChange={(v) => sheets.actions.style.updateEffects.execute({ ...smartPunctuation, enabled: v })}
          />
          <p className="text-2xs text-fg-faint leading-snug m-0">
            Replaces straight quotes, apostrophes, dashes, and ellipses with their typographic equivalents.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Toggle
            label="Carry quotes"
            value={carryQuotes.enabled}
            onChange={(v) => sheets.actions.style.updateEffects.execute({ ...carryQuotes, enabled: v })}
          />
          <p className="text-2xs text-fg-faint leading-snug m-0">
            When a quoted sentence spans several captions, repeats the surrounding quotes on each so it stays clear the speaker is still quoting.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Toggle
            label="Smart lowercase"
            value={smartLowercase.enabled}
            onChange={(v) => sheets.actions.style.updateEffects.execute({ ...smartLowercase, enabled: v })}
          />
          <p className="text-2xs text-fg-faint leading-snug m-0">
            Forces lowercase on every word, except proper nouns and the pronoun "I".
          </p>
        </div>
      </Section>
      <Section title="Emojis">
        <Select
          label="Placement"
          value={emoji.placement}
          options={EMOJI_PLACEMENT_OPTIONS}
          onChange={(v) => sheets.actions.style.updateEffects.execute({ ...emoji, placement: v as EmojiPlacement })}
        />
        <Slider
          label="Size"
          value={emoji.size}
          min={0.5}
          max={3}
          step={0.05}
          onChange={(v) => sheets.actions.style.updateEffects.execute({ ...emoji, size: v })}
        />
        <Slider
          label="Gap"
          value={emoji.gap}
          min={-5}
          max={5}
          step={0.1}
          onChange={(v) => sheets.actions.style.updateEffects.execute({ ...emoji, gap: v })}
        />
      </Section>
    </EditorTab>
  );
});
