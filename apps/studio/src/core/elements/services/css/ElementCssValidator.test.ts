import { describe, expect, it } from 'vitest';
import { CssBlockSealer, CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { BalancedBlocksElementCssRule } from '@core/elements/services/css/BalancedBlocksElementCssRule';
import { ElementCssValidator } from '@core/elements/services/css/ElementCssValidator';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { PlayheadAnchoredAnimationElementCssRule } from '@core/elements/services/css/PlayheadAnchoredAnimationElementCssRule';
import { UndrawnLayerDeclarationElementCssRule } from '@core/elements/services/css/UndrawnLayerDeclarationElementCssRule';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';

function validator(): ElementCssValidator {
  return new ElementCssValidator(new CssMinifier(), new ElementTimingVariableResolver(), [
    new BalancedBlocksElementCssRule(new CssBlockSealer()),
    new PlayheadAnchoredAnimationElementCssRule(),
    new UndrawnLayerDeclarationElementCssRule(),
  ]);
}

function messagesFor(css: string, kind: 'word' | 'segment' | 'decoration' | 'layer' = 'word'): string[] {
  return validator().validate(css, kind).map((problem) => problem.message);
}

/** The part of a layer's life a preset moves, by the part its id ends in. */
function scopeOfPreset(presetId: string): ElementAnimationScope {
  if (presetId.endsWith('-exit')) return ElementAnimationScope.EXIT;
  if (presetId.endsWith('-camera')) return ElementAnimationScope.CAMERA;
  return ElementAnimationScope.ENTRANCE;
}

describe('CSS that will do what it reads like', () => {
  it('passes plain declarations', () => {
    expect(messagesFor('color: gold;')).toEqual([]);
  });

  it('passes an animation anchored to the playhead', () => {
    expect(messagesFor(
      'animation: pop .4s var(--on-word-being-narrated-starts) ease both; @keyframes pop { from { scale: .4 } }',
    )).toEqual([]);
  });

  it('passes an anchor written as a longhand', () => {
    expect(messagesFor(
      'animation-name: pop; animation-duration: 1s; animation-delay: var(--on-segment-starts);',
      'segment',
    )).toEqual([]);
  });

  it('ignores an animation that is commented out', () => {
    expect(messagesFor('/* animation: pop 1s both; */ color: red;')).toEqual([]);
  });

  it('passes an element turned off, which has no frame to hold', () => {
    expect(messagesFor('animation: none;')).toEqual([]);
    expect(messagesFor('animation-name: none;')).toEqual([]);
  });

  it('still reports an unanchored animation sitting next to a switched-off one', () => {
    expect(messagesFor('animation: none; animation: pop 240ms both;')).toHaveLength(1);
  });
});

describe('an animation with no playhead-anchored delay', () => {
  it('is reported, because it renders as a still frame', () => {
    expect(messagesFor('animation: pop 240ms both; @keyframes pop { from { scale: .7 } }'))
      .toHaveLength(1);
  });

  it('names the variable that element kind should anchor to', () => {
    expect(messagesFor('animation: pop 240ms both;', 'word')[0])
      .toContain('--on-word-being-narrated-starts');
    expect(messagesFor('animation: pop 240ms both;', 'segment')[0])
      .toContain('--on-segment-starts');
  });

  it('anchors a decoration to the word it belongs to', () => {
    expect(messagesFor('animation: pop 240ms both;', 'decoration')[0])
      .toContain('--on-word-being-narrated-starts');
  });
});

describe('braces that do not pair up', () => {
  it('reports a closing brace with nothing to open it', () => {
    expect(messagesFor('color: red; } .loose { color: blue }')).toHaveLength(1);
  });

  it('reports a block left open', () => {
    expect(messagesFor('&:hover { color: blue;')).toHaveLength(1);
  });

  it('counts neither braces inside a string nor inside a comment', () => {
    expect(messagesFor('content: "}"; /* } */ color: red;')).toEqual([]);
  });
});

describe('a shot layer\'s CSS', () => {
  it('anchors an entrance to the layer\'s start and an exit to its end', () => {
    const message = messagesFor('--layer-entrance-animation: drop .6s ease both;', 'layer')[0];

    expect(message).toContain('--on-layer-starts');
    expect(message).toContain('--on-layer-ends');
  });

  it('passes an animation published for the framework to play once it is tied to the layer\'s start or end', () => {
    expect(messagesFor('--layer-entrance-animation: drop .6s var(--on-layer-starts) ease both;', 'layer')).toEqual([]);
    expect(messagesFor('--layer-exit-animation: drop .6s calc(var(--on-layer-ends) - .6s) ease both;', 'layer')).toEqual([]);
  });

  it('passes what draws on a layer: its box, transform, opacity, a blur and a brightness, an inset clip, its corners and fit', () => {
    expect(messagesFor(
      'left: 10cqw; width: 40cqw; rotate: 8deg; transform: scale(1.1); opacity: .8; filter: blur(calc(var(--x) * 1px)) brightness(250%);'
        + ' clip-path: inset(0 10% 0 0); border-radius: 4cqmin; object-fit: contain; --layer-width: .5; --video-top: 0px;',
      'layer',
    )).toEqual([]);
  });

  it('reports each declaration that draws nothing, once, in keyframes too', () => {
    const messages = messagesFor(
      'color: red; box-shadow: 0 0 4px black; color: blue; @keyframes glow { from { background: gold; } }',
      'layer',
    );

    expect(messages).toHaveLength(3);
    expect(messages.map((message) => message.split(' ')[0])).toEqual(['color', 'box-shadow', 'background']);
  });

  it('reports a filter holding anything but a blur and a brightness, and a clip other than an inset', () => {
    expect(messagesFor('filter: blur(2px) contrast(2); clip-path: circle(40%);', 'layer')).toHaveLength(2);
    expect(messagesFor('filter: brightness(2) drop-shadow(0 0 4px black);', 'layer')).toHaveLength(1);
  });

  it('says nothing of a caption\'s colour, which the browser paints', () => {
    expect(messagesFor('color: red; box-shadow: 0 0 4px black;', 'word')).toEqual([]);
  });

  it('finds nothing wrong in what the editor writes for a layer: every motion and every layout', () => {
    const controls = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
    const catalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
    const motions = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(catalog, new ElementTimingVariableResolver(), controls));
    const layouts = new TestShotLayerLayouts().writer;
    const written = [
      ...catalog.forKind('layer').map((preset) => motions.rewrite(
        '',
        'layer',
        scopeOfPreset(preset.id),
        undefined,
        { presetId: preset.id, params: {} },
      )),
      ...[
        { kind: 'full', fit: 'contain' } as const,
        { kind: 'split', assetSide: 'end', assetRatio: 0.4, padding: 0.02, cornerRadius: 0.03, fit: 'cover' } as const,
        { kind: 'inset', subject: 'asset', centerX: 0.3, centerY: 0.7, width: 0.4, aspectRatio: 1, padding: 0.04, cornerRadius: 0.04, fit: 'cover' } as const,
      ].map((placement) => layouts.written(ElementStyles.empty(), 'x', placement).get('x')!.css),
    ];

    for (const css of written) expect(messagesFor(css, 'layer')).toEqual([]);
  });
});

describe('what the editor writes for a caption', () => {
  it('finds nothing wrong in it: every entrance and exit, at every part, and each end told not to move', () => {
    const controls = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
    const catalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
    const timing = new ElementTimingVariableResolver();
    const motions = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(catalog, timing, controls));
    const offered = [
      { kind: 'segment', scopes: [ElementAnimationScope.SELF, ElementAnimationScope.WORDS, ElementAnimationScope.EMOJIS,
        ElementAnimationScope.EXIT, ElementAnimationScope.WORDS_EXIT, ElementAnimationScope.EMOJIS_EXIT] },
      { kind: 'word', scopes: [ElementAnimationScope.SELF, ElementAnimationScope.EXIT] },
      { kind: 'decoration', scopes: [ElementAnimationScope.SELF, ElementAnimationScope.EXIT] },
    ] as const;
    for (const { kind, scopes } of offered) {
      for (const scope of scopes) {
        const animated = scope === ElementAnimationScope.WORDS || scope === ElementAnimationScope.WORDS_EXIT ? 'word'
          : scope === ElementAnimationScope.EMOJIS || scope === ElementAnimationScope.EMOJIS_EXIT ? 'decoration' : kind;
        const presets = catalog.forClock(animated, timing.resolve(kind, scope));
        expect(presets.length).toBeGreaterThan(0);
        const answers = [{ presetId: null, params: {} }, ...presets.map((preset) => ({ presetId: preset.id, params: {} }))];
        for (const answer of answers) {
          expect(messagesFor(motions.rewrite('', kind, scope, undefined, answer), kind)).toEqual([]);
        }
      }
    }
  });
});
