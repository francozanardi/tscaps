import { describe, expect, it } from 'vitest';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';

/**
 * What survives being saved and opened again.
 *
 * The boundary drops what it cannot trust, and a silent drop here is
 * the user's work going missing between sessions — so what it keeps
 * and what it refuses are both worth pinning.
 */

const rise = { presetId: 'rise-in', params: { distance: 0.5 } };
const SELF = ElementAnimationScope.SELF;
const WORDS = ElementAnimationScope.WORDS;

describe('a style on its way through storage', () => {
  it('comes back whole', () => {
    const styles = ElementStyles.empty()
      .withAnimation('w1', 'word', SELF, rise, 'animation: rise-in 1s;')
      .withCss('w1', 'word', 'color: gold;');
    const reopened = ElementStyles.fromSnapshot(styles.toSnapshot());
    expect(reopened.get('w1')).toEqual({ kind: 'word', animations: { self: rise }, css: 'color: gold;' });
  });

  it('keeps an element told not to move apart from one nobody answered for', () => {
    const disabled = ElementStyles.empty()
      .withAnimation('w1', 'word', SELF, { presetId: null, params: {} }, 'animation: none;');
    expect(ElementStyles.fromSnapshot(disabled.toSnapshot()).animationOf('w1', SELF)?.presetId).toBeNull();
    expect(ElementStyles.empty().withAnimation('w1', 'word', SELF, undefined, '').get('w1')).toBeNull();
  });

  it('brings each part\'s own answer back under its own name', () => {
    const styles = ElementStyles.empty()
      .withAnimation('s1', 'segment', SELF, rise, 'animation: rise-in 1s;')
      .withAnimation('s1', 'segment', WORDS, { presetId: 'pop-in', params: {} }, 'animation: rise-in 1s; & :where(.word) { animation: pop-in 1s; }');
    const reopened = ElementStyles.fromSnapshot(styles.toSnapshot());
    expect(reopened.animationOf('s1', SELF)).toEqual(rise);
    expect(reopened.animationOf('s1', WORDS)?.presetId).toBe('pop-in');
  });

  it('drops an animation recorded against a part this build does not offer', () => {
    const snapshot = { s1: { kind: 'segment' as const, animations: { letters: rise } as never, css: '' } };
    expect(ElementStyles.fromSnapshot(snapshot).isEmpty()).toBe(true);
  });

  it('drops an entry whose kind this build has never heard of', () => {
    const snapshot = { w1: { kind: 'widget' as never, css: 'color: gold;' } };
    expect(ElementStyles.fromSnapshot(snapshot).isEmpty()).toBe(true);
  });

  // The animation is the half that renders; the CSS beside it is the
  // user's own text and has nothing to do with the animation being
  // unreadable, so losing one must not lose the other.
  it('keeps the hand-written CSS of an element whose animation will not parse', () => {
    const snapshot = { w1: { kind: 'word' as const, animations: 'rise-in' as never, css: 'color: gold;' } };
    const reopened = ElementStyles.fromSnapshot(snapshot);
    expect(reopened.get('w1')).toEqual({ kind: 'word', css: 'color: gold;' });
  });

  it('drops an element that says nothing at all', () => {
    expect(ElementStyles.fromSnapshot({ w1: { kind: 'word', css: '  ' } }).isEmpty()).toBe(true);
  });
});

/**
 * Emptying the text and wiping the element are not the same act, and
 * the difference is what the fields do.
 *
 * A field records its value and writes a declaration, and the two are
 * compared to tell a field that still decides its property from one
 * edited by hand. Leave the values behind when the text goes and every
 * one of them reports itself overruled by CSS that is no longer there.
 */
describe('the two ways an element stops saying something', () => {
  const styled = ElementStyles.empty().withField('w1', 'word', 'underline', 'underline', 'text-decoration-line: underline;');

  it('keeps what the fields hold when the text is emptied', () => {
    expect(styled.withCss('w1', 'word', '').get('w1')?.fields).toEqual({ underline: 'underline' });
  });

  it('forgets them when the element is wiped', () => {
    expect(styled.without(['w1']).get('w1')).toBeNull();
  });
});

/**
 * A placement is all four of its parts or none.
 *
 * An offset is only a place while the anchor it was read against holds
 * still, so half of one that survived storage would put the element
 * somewhere nobody dropped it — and plausible-but-wrong is the one
 * outcome the user cannot spot.
 */
describe('where an element was put', () => {
  const placement = { verticalAlign: 'center', verticalOffset: 0.3, horizontalAlign: 'left', horizontalOffset: 0.2 } as const;

  it('comes back whole', () => {
    const styles = ElementStyles.empty().withPlacement('w1', 'word', placement);
    expect(ElementStyles.fromSnapshot(styles.toSnapshot()).placementOf('w1')).toEqual(placement);
  });

  it('keeps the element even when it says nothing else', () => {
    expect(ElementStyles.empty().withPlacement('w1', 'word', placement).has('w1')).toBe(true);
  });

  it('is dropped when a part of it did not survive', () => {
    const snapshot = { w1: { kind: 'word' as const, css: '', placement: { verticalOffset: 0.3, horizontalOffset: 0.2 } as never } };
    expect(ElementStyles.fromSnapshot(snapshot).isEmpty()).toBe(true);
  });

  it('is dropped when an anchor is not one this build knows', () => {
    const snapshot = { w1: { kind: 'word' as const, css: '', placement: { ...placement, verticalAlign: 'middle' } as never } };
    expect(ElementStyles.fromSnapshot(snapshot).isEmpty()).toBe(true);
  });

  it('leaves the fields and the CSS alone when it is taken back', () => {
    const styled = ElementStyles.empty()
      .withField('w1', 'word', 'underline', 'underline', 'text-decoration-line: underline;')
      .withPlacement('w1', 'word', placement);
    const home = styled.withPlacement('w1', 'word', undefined);
    expect(home.placementOf('w1')).toBeNull();
    expect(home.get('w1')?.fields).toEqual({ underline: 'underline' });
    expect(home.get('w1')?.css).toBe('text-decoration-line: underline;');
  });
});

describe('how an element composites against the picture', () => {
  it('comes back whole', () => {
    const styles = ElementStyles.empty().withBlend('w1', 'word', 'difference');
    expect(ElementStyles.fromSnapshot(styles.toSnapshot()).blendOf('w1')).toBe('difference');
  });

  it('keeps the element even when it says nothing else', () => {
    expect(ElementStyles.empty().withBlend('w1', 'word', 'difference').has('w1')).toBe(true);
  });

  it('drops the element once the blend is taken back and nothing else is left', () => {
    const blended = ElementStyles.empty().withBlend('w1', 'word', 'difference');
    expect(blended.withBlend('w1', 'word', undefined).has('w1')).toBe(false);
  });

  it('is dropped when the mode is not one this build knows', () => {
    const snapshot = { w1: { kind: 'word' as const, css: '', effects: { blend: 'multiply' } as never } };
    expect(ElementStyles.fromSnapshot(snapshot).isEmpty()).toBe(true);
  });

  it('leaves the fields and the CSS alone when it is taken back', () => {
    const styled = ElementStyles.empty()
      .withField('w1', 'word', 'underline', 'underline', 'text-decoration-line: underline;')
      .withBlend('w1', 'word', 'difference');
    const plain = styled.withBlend('w1', 'word', undefined);
    expect(plain.blendOf('w1')).toBeNull();
    expect(plain.get('w1')?.fields).toEqual({ underline: 'underline' });
    expect(plain.get('w1')?.css).toBe('text-decoration-line: underline;');
  });
});
