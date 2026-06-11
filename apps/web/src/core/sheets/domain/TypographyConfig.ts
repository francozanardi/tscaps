/**
 * Typography is a fixed set of universally-meaningful knobs (font family,
 * font size, font weight, three flavours of spacing, text case, and the
 * word-processor style toggles: italic/underline/strikethrough). It used
 * to live as "universal" style controls that every template opted into —
 * but since every template always opted in, the indirection was dead
 * weight. It is now a first-class config on every Sheet, mirroring
 * `AlignmentConfig`.
 *
 * `fontWeight` is always set (CSS-style 100..900 in steps of 100) and
 * always emitted as `--tscaps-font-weight` — variable fonts make the full
 * range meaningful, so we expose it as a slider rather than the binary
 * bold toggle the pre-variable era used.
 *
 * Templates declare their preferred defaults (which font, which size, etc.)
 * as part of their JSON; when the user switches templates, typography
 * resets to the new template's defaults along with everything else.
 */
export interface TypographyConfig {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly letterSpacing: number;
  readonly wordSpacing: number;
  readonly lineSpacing: number;
  readonly textCase: TextCase;
  readonly textAlign: TextAlign;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strikethrough: boolean;
}

export type TextCase = 'none' | 'uppercase' | 'lowercase';
export type TextAlign = 'left' | 'center' | 'right';

/**
 * `fontSize` is in `cqh` units — a percentage of the video's height — so
 * captions scale automatically with the video and look the same on any
 * resolution at a given aspect ratio. The convention follows broadcast
 * subtitling (`1/30`–`1/20` of vertical space), which means horizontals
 * render at a smaller absolute size than verticals — matching the
 * "TV-discreet vs. shorts-chunky" reading. `wordSpacing` and
 * `lineSpacing` are in `em` so they track the current font-size:
 * changing font-size also changes inter-word/inter-line gaps
 * proportionally. Defaults are calibrated against a 720×1280 vertical
 * reference (3.13cqh ≈ 40px at that height).
 */
export const TYPOGRAPHY_DEFAULTS: TypographyConfig = {
  fontFamily: 'Inter Variable',
  fontSize: 3.13,
  fontWeight: 400,
  letterSpacing: 0,
  wordSpacing: 0,
  lineSpacing: 0,
  textCase: 'none',
  textAlign: 'center',
  italic: false,
  underline: false,
  strikethrough: false,
};
