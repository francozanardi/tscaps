import { describe, expect, it } from 'vitest';
import { CssKeyframesScanner } from '@modules/css/CssKeyframesScanner';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { KeyframeScanAnimationStateFingerprint } from '@modules/rendering/subtitle/KeyframeScanAnimationStateFingerprint';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

/**
 * Whether a style can move at all, read off the CSS that reaches its
 * tiles. Answering "no" for a style that moves makes the planner reuse
 * one tile across a frame that moved, so every channel carrying CSS
 * into a tile has to be read — a stylesheet is only the first of them.
 */

interface StyleParts {
  readonly scopedCss?: string;
  readonly baselineCss?: string;
  readonly inlineStyles?: Record<string, string>;
  readonly subtreeOverrides?: ElementRenderOverrides;
  readonly segmentOverrides?: ElementRenderOverrides;
}

function styleWith(parts: StyleParts): PreparedStyle {
  return {
    kind: 'main',
    scopedCss: parts.scopedCss ?? '',
    baselineCss: parts.baselineCss ?? '',
    inlineStyles: parts.inlineStyles ?? {},
    subtreeOverrides: parts.subtreeOverrides ?? ElementRenderOverrides.empty(),
    segmentOverrides: parts.segmentOverrides ?? ElementRenderOverrides.empty(),
  } as unknown as PreparedStyle;
}

async function sharesTiles(parts: StyleParts): Promise<boolean> {
  const probe = new KeyframeScanAnimationStateFingerprint(new CssKeyframesScanner());
  return (await probe.at(styleWith(parts))) !== null;
}

const AN_ANIMATION = '@keyframes rise { from { opacity: 0 } to { opacity: 1 } } .word { animation: rise 0.2s both }';

describe('a style whose css applies no animation', () => {
  it('lets its timestamps share tiles', async () => {
    expect(await sharesTiles({ scopedCss: '.word { color: white; font-weight: 700 }' })).toBe(true);
  });

  it('shares nothing once a keyframes block is defined, applied or not', async () => {
    expect(await sharesTiles({ scopedCss: '@keyframes unused { from { opacity: 0 } }' })).toBe(false);
  });

  // The name is not in the declaration to be found, so only the block
  // it refers to gives the animation away.
  it('shares nothing for an animation whose name arrives through a variable', async () => {
    const css = '@keyframes rise { from { opacity: 0 } } .word { animation: var(--entrance) 0.2s both }';
    expect(await sharesTiles({ scopedCss: css })).toBe(false);
  });
});

describe('a style that can move', () => {
  it('shares nothing when its stylesheet applies an animation', async () => {
    expect(await sharesTiles({ scopedCss: AN_ANIMATION })).toBe(false);
  });

  it('shares nothing when the animation is in the baseline the engine adds', async () => {
    expect(await sharesTiles({ baselineCss: AN_ANIMATION })).toBe(false);
  });

  it('shares nothing when a transition could fire on first paint', async () => {
    expect(await sharesTiles({ scopedCss: '.word { transition: opacity 1s } @starting-style { .word { opacity: 0 } }' }))
      .toBe(false);
  });
});

// Inline styles are a second channel into the tile, and one an
// animation can travel down without appearing in any stylesheet.
describe('an animation carried by an inline style', () => {
  it('is seen on the style root', async () => {
    expect(await sharesTiles({ inlineStyles: { animation: 'rise 0.2s both' } })).toBe(false);
  });

  it('is seen on a single word', async () => {
    const overrides = ElementRenderOverrides.fromEntries([
      ['w1', { inlineStyles: { animation: 'rise 0.2s both' } }],
    ]);
    expect(await sharesTiles({ subtreeOverrides: overrides })).toBe(false);
  });

  it('is seen on a single segment', async () => {
    const overrides = ElementRenderOverrides.fromEntries([
      ['s1', { inlineStyles: { 'animation-name': 'rise' } }],
    ]);
    expect(await sharesTiles({ segmentOverrides: overrides })).toBe(false);
  });

  it('leaves a word carrying only static declarations sharing tiles', async () => {
    const overrides = ElementRenderOverrides.fromEntries([
      ['w1', { inlineStyles: { color: 'red', '--tscaps-font-size': '4cqh' } }],
    ]);
    expect(await sharesTiles({ subtreeOverrides: overrides })).toBe(true);
  });
});
