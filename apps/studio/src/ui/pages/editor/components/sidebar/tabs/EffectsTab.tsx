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
import { SwitchCard } from '@ui/_shared/components/controls/fields/SwitchCard';
import { PictureChoice } from '@ui/_shared/components/controls/fields/PictureChoice';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { BeforeAfterTextPicture } from '@ui/pages/editor/components/sidebar/tabs/effects/BeforeAfterTextPicture';
import { GapFreePicture } from '@ui/pages/editor/components/sidebar/tabs/effects/GapFreePicture';
import { EmojiPlacementPicture } from '@ui/pages/editor/components/sidebar/tabs/effects/EmojiPlacementPicture';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

const EMOJI_PLACEMENT_OPTIONS = ([
  { value: 'segment-below', label: 'Below' },
  { value: 'segment-above', label: 'Above' },
  { value: 'word', label: 'Inline' },
] as const satisfies ReadonlyArray<{ value: EmojiPlacement; label: string }>)
  .map((option) => ({ ...option, picture: <EmojiPlacementPicture placement={option.value} /> }));


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
        <SwitchCard
          title="Gap-free"
          legend="Keeps each caption on screen until the next one starts, hiding short pauses between them."
          picture={<GapFreePicture />}
          checked={gapFree.enabled}
          onCheckedChange={(v) => sheets.actions.style.updateEffects.execute({ ...gapFree, enabled: v })}
        />
        <SwitchCard
          title="Remove punctuation"
          legend="Drops commas, periods, colons, and ellipses at the end of words. Question and exclamation marks stay."
          picture={<BeforeAfterTextPicture before="Hi, you." after="Hi you" />}
          checked={removePunctuation.enabled}
          onCheckedChange={(v) => sheets.actions.style.updateEffects.execute({ ...removePunctuation, enabled: v })}
        />
        <SwitchCard
          title="Smart punctuation"
          legend="Replaces straight quotes, apostrophes, dashes, and ellipses with their typographic equivalents."
          picture={<BeforeAfterTextPicture before={'"so..."'} after="“so…”" />}
          checked={smartPunctuation.enabled}
          onCheckedChange={(v) => sheets.actions.style.updateEffects.execute({ ...smartPunctuation, enabled: v })}
        />
        <SwitchCard
          title="Carry quotes"
          legend="When a quoted sentence spans several captions, repeats the surrounding quotes on each so it stays clear the speaker is still quoting."
          picture={<BeforeAfterTextPicture before={['“go', 'on”']} after={['“go”', '“on”']} />}
          checked={carryQuotes.enabled}
          onCheckedChange={(v) => sheets.actions.style.updateEffects.execute({ ...carryQuotes, enabled: v })}
        />
        <SwitchCard
          title="Smart lowercase"
          legend={'Forces lowercase on every word, except proper nouns and the pronoun "I".'}
          picture={<BeforeAfterTextPicture before="So I Did" after="so I did" />}
          checked={smartLowercase.enabled}
          onCheckedChange={(v) => sheets.actions.style.updateEffects.execute({ ...smartLowercase, enabled: v })}
        />
      </Section>
      <Section title="Emojis">
        <PictureChoice
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
