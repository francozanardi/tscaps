/**
 * Tagged union of every supported effect's persisted config. The `type`
 * field discriminates which concrete effect class the registry should
 * build. `enabled` is universal: registries don't filter on it, but the
 * deriver only instantiates effects whose config has `enabled: true`.
 *
 * Templates declare their preferred defaults (including `enabled`) in
 * template.json; the user can flip any effect on/off at runtime.
 */
export type EffectConfig =
  | GapFreeEffectConfig
  | RemovePunctuationEffectConfig
  | SmartPunctuationEffectConfig
  | SmartLowercaseEffectConfig
  | CarryQuotesEffectConfig;

export interface GapFreeEffectConfig {
  readonly type: 'gap_free';
  readonly enabled: boolean;
}

export interface RemovePunctuationEffectConfig {
  readonly type: 'remove_punctuation';
  readonly enabled: boolean;
}

export interface SmartPunctuationEffectConfig {
  readonly type: 'smart_punctuation';
  readonly enabled: boolean;
}

export interface SmartLowercaseEffectConfig {
  readonly type: 'smart_lowercase';
  readonly enabled: boolean;
}

export interface CarryQuotesEffectConfig {
  readonly type: 'carry_quotes';
  readonly enabled: boolean;
}
