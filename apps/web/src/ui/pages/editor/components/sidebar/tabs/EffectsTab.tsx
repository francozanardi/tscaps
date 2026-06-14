import { memo } from 'react';
import type {
  GapFreeEffectConfig,
  RemovePunctuationEffectConfig,
  SmartPunctuationEffectConfig,
  SmartLowercaseEffectConfig,
  CarryQuotesEffectConfig,
} from '@core/effect/domain/EffectConfig';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

interface EffectsTabProps {
  sheetScope: SheetScope;
}

export const EffectsTab = memo(function EffectsTab({ sheetScope }: EffectsTabProps) {
  const { effects } = useEngine();
  const sheets = useSheets();
  const configs = sheetScope.activeSheet.effectConfigs;

  // Fall back to the registry default when a sheet was serialized before
  // this effect existed — keeps the toggle rendering a sensible state.
  const gapFree = configs.find((c): c is GapFreeEffectConfig => c.type === 'gap_free')
    ?? (effects.get('gap_free').defaultConfig as GapFreeEffectConfig);
  const removePunctuation = configs.find((c): c is RemovePunctuationEffectConfig => c.type === 'remove_punctuation')
    ?? (effects.get('remove_punctuation').defaultConfig as RemovePunctuationEffectConfig);
  const smartPunctuation = configs.find((c): c is SmartPunctuationEffectConfig => c.type === 'smart_punctuation')
    ?? (effects.get('smart_punctuation').defaultConfig as SmartPunctuationEffectConfig);
  const smartLowercase = configs.find((c): c is SmartLowercaseEffectConfig => c.type === 'smart_lowercase')
    ?? (effects.get('smart_lowercase').defaultConfig as SmartLowercaseEffectConfig);
  const carryQuotes = configs.find((c): c is CarryQuotesEffectConfig => c.type === 'carry_quotes')
    ?? (effects.get('carry_quotes').defaultConfig as CarryQuotesEffectConfig);

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
    </EditorTab>
  );
});
