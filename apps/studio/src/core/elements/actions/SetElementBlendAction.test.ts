import { describe, expect, it } from 'vitest';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
import { SetElementBlendAction } from '@core/elements/actions/SetElementBlendAction';

/**
 * What blending one element does to the blends of the elements inside
 * it. A blend inside a blend composites against the group around it,
 * not the video, so a word left blending inside a blending caption
 * would paint as nearly nothing while its panel still said "Difference".
 */

/** One caption, one line, two words, a glyph on the first of them. */
const INSIDE: Readonly<Record<string, ReadonlyArray<string>>> = {
  seg1: ['l1', 'w1', 'w2', 'w1:d'],
  l1: ['w1', 'w2', 'w1:d'],
  w1: ['w1:d'],
};

const descendantResolver: ElementDescendantResolver = {
  descendantsOf: (elementId) => new Set(INSIDE[elementId] ?? []),
};

// The document is never derived here, so re-piping it has nothing to do.
const refresh = { execute: () => {} } as unknown as RefreshDocumentAction;

describe('a blend given to the caption', () => {
  it('is taken off the words and glyphs inside it', () => {
    const store = new EditorStore();
    const action = new SetElementBlendAction(store, descendantResolver, refresh);
    action.execute('w2', 'word', 'difference');
    action.execute('w1:d', 'decoration', 'difference');

    action.execute('seg1', 'segment', 'difference');

    const styles = store.snapshot().elementStyles;
    expect(styles.blendOf('seg1')).toBe('difference');
    expect(styles.blendOf('w2')).toBeNull();
    expect(styles.blendOf('w1:d')).toBeNull();
  });

  it('leaves the rest of what an inner element holds', () => {
    const store = new EditorStore();
    const action = new SetElementBlendAction(store, descendantResolver, refresh);
    store.patch({ elementStyles: store.snapshot().elementStyles.withCss('w2', 'word', 'color: red;') });
    action.execute('w2', 'word', 'difference');

    action.execute('seg1', 'segment', 'difference');

    expect(store.snapshot().elementStyles.get('w2')?.css).toBe('color: red;');
  });
});

describe('a blend taken back', () => {
  it('leaves the elements inside alone', () => {
    const store = new EditorStore();
    const action = new SetElementBlendAction(store, descendantResolver, refresh);
    action.execute('seg1', 'segment', 'difference');
    action.execute('w2', 'word', 'difference');

    action.clear('seg1', 'segment');

    const styles = store.snapshot().elementStyles;
    expect(styles.blendOf('seg1')).toBeNull();
    expect(styles.blendOf('w2')).toBe('difference');
  });
});
