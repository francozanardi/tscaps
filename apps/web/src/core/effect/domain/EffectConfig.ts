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
  | CarryQuotesEffectConfig
  | EmojiEffectConfig;

/**
 * Placement of AI-picked emoji decorations attached to words.
 *
 * - `'word'` — the glyph renders inline immediately after its anchor
 *   word as part of the caption text.
 * - `'segment-above'` — every glyph from a segment renders as a single
 *   row above the segment, outside the line flow.
 * - `'segment-below'` — same, rendered below the segment.
 */
export type EmojiPlacement = 'word' | 'segment-above' | 'segment-below';

export interface EmojiEffectConfig {
  readonly type: 'emoji';
  readonly enabled: boolean;
  readonly placement: EmojiPlacement;
  /** Multiplier the rendered glyph applies to its inherited font size. `1` matches the caption font size. */
  readonly size: number;
  /** Multiplier applied to the baseline distance between the glyph and its anchor: horizontal gap for inline placement, vertical gap for `segment-above` / `segment-below`. */
  readonly gap: number;
}

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

export const EMOJI_PLACEMENT_DEFAULT: EmojiPlacement = 'segment-below';
export const EMOJI_SIZE_DEFAULT = 1.8;
export const EMOJI_GAP_DEFAULT = 0.1;
