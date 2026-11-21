import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { SetElementAnimationAction } from '@core/elements/actions/SetElementAnimationAction';

/**
 * What an animation given on one element does to the animations of the
 * elements it reaches.
 *
 * The rule the fields already follow: the answer given last is the one
 * to obey, so answering further out takes over what is inside. The
 * alternative is a control that quietly fails to reach some elements
 * and says nothing about which.
 */

const catalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
const builder = new ElementAnimationCssBuilder(
  catalog,
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
);
const animationCssWriter = new ElementAnimationCssWriter(builder);

/** One caption, one line, two words, a glyph on the first of them. */
const INSIDE: Readonly<Record<string, ReadonlyArray<string>>> = {
  seg1: ['l1', 'w1', 'w2', 'w1:d'],
  l1: ['w1', 'w2', 'w1:d'],
  w1: ['w1:d'],
};
const descendantResolver: ElementDescendantResolver = {
  descendantsOf: (elementId) => new Set(INSIDE[elementId] ?? []),
};

const refresh = { execute: () => {} } as unknown as RefreshDocumentAction;

const SELF = ElementAnimationScope.SELF;
const WORDS = ElementAnimationScope.WORDS;
const EMOJIS = ElementAnimationScope.EMOJIS;
const EXIT = ElementAnimationScope.EXIT;
const WORDS_EXIT = ElementAnimationScope.WORDS_EXIT;

function actionOn(store: EditorStore): SetElementAnimationAction {
  return new SetElementAnimationAction(store, descendantResolver, animationCssWriter, refresh);
}

describe('an animation the caption gives its words', () => {
  it('is given up by a word that had one of its own', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');

    action.apply('seg1', 'segment', WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)).toBeNull();
  });

  it('takes the word\'s block out of its CSS along with the record', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');

    action.apply('seg1', 'segment', WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.get('w1')).toBeNull();
  });

  it('leaves a glyph alone, since a glyph is not one of the words', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1:d', 'decoration', SELF, 'pop-in');

    action.apply('seg1', 'segment', WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1:d', SELF)?.presetId).toBe('pop-in');
  });

  it('is overridden again by a word answered after it', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('seg1', 'segment', WORDS, 'rise-in');

    action.apply('w1', 'word', SELF, 'pop-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
    expect(store.snapshot().elementStyles.animationOf('seg1', WORDS)?.presetId).toBe('rise-in');
  });

  it('reaches a word through the line it was laid out on', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w2', 'word', SELF, 'pop-in');

    action.apply('l1', 'line', WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w2', SELF)).toBeNull();
  });
});

describe('an animation the caption gives its glyphs', () => {
  it('is given up by a glyph that had one of its own', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1:d', 'decoration', SELF, 'pop-in');

    action.apply('seg1', 'segment', EMOJIS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1:d', SELF)).toBeNull();
  });

  it('leaves the words alone, since a word is not one of the glyphs', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');

    action.apply('seg1', 'segment', EMOJIS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
  });

  it('stands beside the answer given to the words, since they are two questions', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('seg1', 'segment', WORDS, 'rise-in');

    action.apply('seg1', 'segment', EMOJIS, 'pop-in');

    expect(store.snapshot().elementStyles.animationOf('seg1', WORDS)?.presetId).toBe('rise-in');
    expect(store.snapshot().elementStyles.animationOf('seg1', EMOJIS)?.presetId).toBe('pop-in');
  });
});

describe('an exit the caption gives its words', () => {
  it('is given up by a word that had an exit of its own', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', EXIT, 'rise-out');

    action.apply('seg1', 'segment', WORDS_EXIT, 'fade-out');

    expect(store.snapshot().elementStyles.animationOf('w1', EXIT)).toBeNull();
  });

  // How the words leave says nothing about how one of them arrives, and
  // the two play together.
  it('leaves the entrance that word was given', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');

    action.apply('seg1', 'segment', WORDS_EXIT, 'fade-out');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
  });

  it('is left alone by an entrance the caption gives its words', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', EXIT, 'rise-out');

    action.apply('seg1', 'segment', WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', EXIT)?.presetId).toBe('rise-out');
  });
});

describe('an entrance and an exit one element is given', () => {
  it('are each recorded and written on their own', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');
    action.apply('w1', 'word', EXIT, 'fade-out');

    action.clear('w1', 'word', SELF);

    const styles = store.snapshot().elementStyles;
    expect(styles.animationOf('w1', SELF)).toBeNull();
    expect(styles.animationOf('w1', EXIT)?.presetId).toBe('fade-out');
    expect(animationCssWriter.isTakenOver(styles.get('w1')!.css, 'word', EXIT, styles.animationOf('w1', EXIT)!)).toBe(false);
  });
});

describe('an animation the caption gives itself', () => {
  it('leaves the words inside it alone, since it moves none of them', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');

    action.apply('seg1', 'segment', SELF, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
  });
});

/**
 * Picking is also how the motion is watched again, so the same answer
 * arrives over and over while a value is being tuned. Treating each of
 * those as a fresh answer would reset the very value being looked at.
 */
describe('the animation a scope already has, given again', () => {
  const distance = catalog.byId('rise-in')!.controls.find((control) => control.id === 'distance')!;

  it('keeps the value it was tuned to', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'rise-in');
    action.setControl('w1', 'word', SELF, distance, 0.9);

    action.apply('w1', 'word', SELF, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.params[distance.id]).toBe(0.9);
  });

  it('leaves the styles exactly where they were', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'rise-in');
    action.setControl('w1', 'word', SELF, distance, 0.9);
    const before = store.snapshot().elementStyles;

    action.apply('w1', 'word', SELF, 'rise-in');

    expect(store.snapshot().elementStyles).toBe(before);
  });

  it('does not reach back into a word that was answered after it', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('seg1', 'segment', WORDS, 'rise-in');
    action.apply('w1', 'word', SELF, 'pop-in');

    action.apply('seg1', 'segment', WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
  });
});

describe('a word whose animation the code editor has taken over', () => {
  it('keeps the block somebody wrote, and stops being described by the list', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.apply('w1', 'word', SELF, 'pop-in');
    const edited = store.snapshot().elementStyles
      .withCss('w1', 'word', `${store.snapshot().elementStyles.get('w1')?.css ?? ''}\ncolor: gold;`.replace('pop', 'pop-slowly'));
    store.patch({ elementStyles: edited });

    action.apply('seg1', 'segment', WORDS, 'rise-in');

    const word = store.snapshot().elementStyles.get('w1');
    expect(word?.animations?.[SELF]).toBeUndefined();
    expect(word?.css).toContain('pop-slowly');
  });
});
