import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { Sheet } from '@core/sheets/domain/Sheet';
import { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { Template } from '@core/templates/domain/Template';
import { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';
import { ReplaceSheetAnimationAction } from '@core/sheets/actions/style/ReplaceSheetAnimationAction';
import { BODY_ONLY_MODES } from '@core/templates/domain/definition/TemplateMode';

/**
 * What a sheet's answer does to the answers already given below it.
 *
 * It reaches further than an element's. A caption told how its words
 * arrive is holding an answer *about words*, so a sheet answering for
 * the words has to take that one as well — not only the answers the
 * words gave themselves. Comparing the kind rather than the scope is
 * what makes both fall.
 */

const builder = new ElementAnimationCssBuilder(
  new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
);
const animationCssWriter = new ElementAnimationCssWriter(builder);

/** One caption, one line, two words, a glyph on the first of them. */
const UNDER_THE_SHEET = new Set(['seg1', 'l1', 'w1', 'w2', 'w1:d']);
const elementResolver: SheetElementResolver = {
  elementsOf: (sheetId) => (sheetId === 'main' ? UNDER_THE_SHEET : new Set<string>()),
};

const linkedSheetsSync = {
  applyStyleEdit: (updated: Sheet, sheets: ReadonlyArray<Sheet>) =>
    sheets.map((sheet) => (sheet.id === updated.id ? updated : sheet)),
} as unknown as LinkedSheetsSync;

const refresh = { execute: () => {} } as unknown as RefreshDocumentAction;

const SELF = ElementAnimationScope.SELF;
const SEGMENTS = ElementAnimationScope.SEGMENTS;
const WORDS = ElementAnimationScope.WORDS;
const EMOJIS = ElementAnimationScope.EMOJIS;
const EXIT = ElementAnimationScope.EXIT;
const WORDS_EXIT = ElementAnimationScope.WORDS_EXIT;

const ANIMATABLE = { segment: true, line: true, word: true, decoration: true };

function sheetSaying(animations: SheetAnimationSet, animation = ANIMATABLE): Sheet {
  return new Sheet({
    id: 'main',
    name: 'Main',
    color: null,
    template: { features: { animation }, modes: BODY_ONLY_MODES } as unknown as Template,
    variantIndex: 0,
    styleValues: StyleValues.fromTemplate([]),
    typographyConfig: TYPOGRAPHY_DEFAULTS,
    rotationConfig: ROTATION_DEFAULTS,
    segmentSplitterConfigs: [],
    lineSplitterConfig: { mode: 'none' } as never,
    alignmentConfig: { verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0 },
    effectConfigs: [],
    animations,
  });
}

function storeShowing(elementStyles: ElementStyles): EditorStore {
  const store = new EditorStore();
  store.patch({ sheets: [sheetSaying(SheetAnimationSet.empty())], activeSheetId: 'main', elementStyles });
  return store;
}

function actionOn(store: EditorStore): ReplaceSheetAnimationAction {
  return new ReplaceSheetAnimationAction(
    store, elementResolver, builder, animationCssWriter, linkedSheetsSync, refresh, new AnimationSupportResolver(),
  );
}

/** Gives one of an element's parts `presetId`, `pop-in` unless told otherwise, the way the element panel would. */
function elementAnimated(
  styles: ElementStyles,
  elementId: string,
  kind: 'segment' | 'line' | 'word' | 'decoration',
  scope: ElementAnimationScope,
  presetId = 'pop-in',
): ElementStyles {
  const animation = { presetId, params: {} };
  const css = animationCssWriter.rewrite(styles.get(elementId)?.css ?? '', kind, scope, undefined, animation);
  return styles.withAnimation(elementId, kind, scope, animation, css);
}

describe('an animation the sheet gives every word', () => {
  it('is given up by a word that had one of its own', () => {
    const store = storeShowing(elementAnimated(ElementStyles.empty(), 'w1', 'word', SELF));
    actionOn(store).apply(WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)).toBeNull();
  });

  it('is given up by a caption that had answered for its words', () => {
    const store = storeShowing(elementAnimated(ElementStyles.empty(), 'seg1', 'segment', WORDS));
    actionOn(store).apply(WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('seg1', WORDS)).toBeNull();
  });

  it('leaves that caption\'s answer about itself standing', () => {
    const store = storeShowing(elementAnimated(ElementStyles.empty(), 'seg1', 'segment', SELF));
    actionOn(store).apply(WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('seg1', SELF)?.presetId).toBe('pop-in');
  });

  it('leaves a glyph alone, since a glyph is not one of the words', () => {
    const store = storeShowing(elementAnimated(ElementStyles.empty(), 'w1:d', 'decoration', SELF));
    actionOn(store).apply(WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1:d', SELF)?.presetId).toBe('pop-in');
  });

  it('reaches nothing under another sheet', () => {
    const store = new EditorStore();
    const other = sheetSaying(SheetAnimationSet.empty()).with({ id: 'other' });
    store.patch({
      sheets: [other],
      activeSheetId: 'other',
      elementStyles: elementAnimated(ElementStyles.empty(), 'w1', 'word', SELF),
    });
    actionOn(store).apply(WORDS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
  });
});

describe('an exit the sheet gives every word', () => {
  it('is given up by a word that had an exit of its own, and by a caption that had one for its words', () => {
    const styles = elementAnimated(
      elementAnimated(ElementStyles.empty(), 'w1', 'word', EXIT, 'rise-out'),
      'seg1', 'segment', WORDS_EXIT, 'rise-out',
    );
    const store = storeShowing(styles);
    actionOn(store).apply(WORDS_EXIT, 'fade-out');

    expect(store.snapshot().elementStyles.animationOf('w1', EXIT)).toBeNull();
    expect(store.snapshot().elementStyles.animationOf('seg1', WORDS_EXIT)).toBeNull();
  });

  // How the words leave says nothing about how they arrive, and the two
  // ends play together.
  it('leaves the entrances given to the words, by themselves or by their caption', () => {
    const styles = elementAnimated(
      elementAnimated(ElementStyles.empty(), 'w1', 'word', SELF),
      'seg1', 'segment', WORDS,
    );
    const store = storeShowing(styles);
    actionOn(store).apply(WORDS_EXIT, 'fade-out');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
    expect(store.snapshot().elementStyles.animationOf('seg1', WORDS)?.presetId).toBe('pop-in');
  });
});

describe('an animation the sheet gives every caption', () => {
  it('is given up by a caption that had one of its own', () => {
    const store = storeShowing(elementAnimated(ElementStyles.empty(), 'seg1', 'segment', SELF));
    actionOn(store).apply(SEGMENTS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('seg1', SELF)).toBeNull();
  });

  it('leaves the words inside it alone, since it moves none of them', () => {
    const store = storeShowing(elementAnimated(ElementStyles.empty(), 'w1', 'word', SELF));
    actionOn(store).apply(SEGMENTS, 'rise-in');

    expect(store.snapshot().elementStyles.animationOf('w1', SELF)?.presetId).toBe('pop-in');
  });
});

describe('what the sheet records', () => {
  it('is the animation and the block it renders as', () => {
    const store = storeShowing(ElementStyles.empty());
    actionOn(store).apply(EMOJIS, 'rise-in');

    const held = store.activeSheet()?.animations.get(EMOJIS);
    expect(held?.kind === 'replaced' ? held.animation.presetId : null).toBe('rise-in');
    expect(held?.css).toContain('.word-decoration');
  });

  it('keeps the value it was tuned to when the same answer is given again', () => {
    const store = storeShowing(ElementStyles.empty());
    const action = actionOn(store);
    action.apply(WORDS, 'rise-in');
    const control = { id: 'distance', property: '--entrance-rise', part: 'magnitude' } as never;
    action.setControl(WORDS, control, 0.9);

    action.apply(WORDS, 'rise-in');

    const held = store.activeSheet()?.animations.get(WORDS);
    expect(held?.kind === 'replaced' ? held.animation.params.distance : undefined).toBe(0.9);
  });

  it('is nothing at all once the answer is taken back', () => {
    const store = storeShowing(ElementStyles.empty());
    const action = actionOn(store);
    action.apply(SEGMENTS, 'rise-in');

    action.clear(SEGMENTS);

    expect(store.activeSheet()?.animations.isEmpty()).toBe(true);
  });
});

/**
 * A template whose look does not survive an animation on some kind of
 * element — one blending its captions with the video, where any
 * stacking context between the blend and the frame cuts it.
 *
 * The panel hides the choice, but hiding is not refusing: a link group
 * carries one sheet's edit across to siblings on other templates, and
 * this is the one place every path passes through.
 */
describe('a kind the template cannot survive an animation on', () => {
  function storeOn(support: typeof ANIMATABLE): EditorStore {
    const store = new EditorStore();
    store.patch({
      sheets: [sheetSaying(SheetAnimationSet.empty(), support)],
      activeSheetId: 'main',
      elementStyles: ElementStyles.empty(),
    });
    return store;
  }

  it('is not given one', () => {
    const store = storeOn({ ...ANIMATABLE, segment: false });
    actionOn(store).apply(SEGMENTS, 'rise-in');

    expect(store.snapshot().sheets[0]!.animations.get(SEGMENTS)).toBeNull();
  });

  it('is not told to hold still either, which would be a block it never asked for', () => {
    const store = storeOn({ ...ANIMATABLE, segment: false });
    actionOn(store).disable(SEGMENTS);

    expect(store.snapshot().sheets[0]!.animations.get(SEGMENTS)).toBeNull();
  });

  it('leaves every other kind answerable', () => {
    const store = storeOn({ ...ANIMATABLE, segment: false });
    actionOn(store).apply(WORDS, 'rise-in');

    expect(store.snapshot().sheets[0]!.animations.get(WORDS)).not.toBeNull();
  });
});
