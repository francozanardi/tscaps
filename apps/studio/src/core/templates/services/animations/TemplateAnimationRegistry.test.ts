import { describe, expect, it } from 'vitest';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import { TemplateAnimationRegistry } from '@core/templates/services/animations/TemplateAnimationRegistry';

/**
 * What a template said about its own movement, taken down while its
 * stylesheet compiles.
 *
 * Two things are read here and nowhere else. The element decides where
 * an answer belongs — a caption's entrance and its words' are the same
 * animation on two elements — so filing the wrong one puts a dial where
 * its value cannot reach. And a value the call sites disagree on is
 * dropped, because a template that says two things about one property
 * has no single value a dial could start on; offering one anyway would
 * flatten the design the first time it moved.
 */

const RISE = '--entrance-rise';
const SLIDE = '--entrance-slide';

function registry(): TemplateAnimationRegistry {
  return new TemplateAnimationRegistry();
}

function em(amount: number): AnimationValue {
  return { kind: 'number', amount, unit: 'em' };
}

function given(...pairs: ReadonlyArray<readonly [string, AnimationValue]>): Map<string, AnimationValue> {
  return new Map(pairs);
}

describe('the element an animation was applied to', () => {
  it('is the one the template named', () => {
    const applied = registry();

    applied.declare('rise-in', 'segment', given(), ['tscaps-rise-in'], 'entrance');

    expect(applied.declared()).toEqual([
      { id: 'rise-in', element: 'segment', values: {}, keyframes: ['tscaps-rise-in'] },
    ]);
  });

  it('can be a node no element addresses on its own', () => {
    const applied = registry();

    applied.declare('typewriter', 'letter', given(), ['tscaps-typewriter'], 'entrance');

    expect(applied.declared()[0]?.element).toBe('letter');
  });

  it('says it plays at the exit when the template says so, and says nothing for an entrance', () => {
    const applied = registry();

    applied.declare('rise-in', 'word', given(), ['tscaps-rise-in'], 'entrance');
    applied.declare('word-out', 'word', given(), ['tscaps-word-out'], 'exit');

    expect(applied.declared().map((animation) => animation.end)).toEqual([undefined, 'exit']);
  });

  it('is refused when one animation on one kind plays at both ends', () => {
    const applied = registry();

    applied.declare('drift', 'word', given(), ['tscaps-drift'], 'entrance');

    expect(() => applied.declare('drift', 'word', given(), ['tscaps-drift'], 'exit')).toThrow(/both/);
  });

  it('is refused when it names nothing the document has', () => {
    const applied = registry();

    expect(() => applied.declare('rise-in', 'sentence', given(), [], 'entrance')).toThrow(/sentence/);
  });
});

describe('one animation applied more than once', () => {
  it('collapses into one answer when it lands on one element', () => {
    const applied = registry();

    applied.declare('slide-in', 'segment', given([SLIDE, em(1.5)]), ['tscaps-slide-in'], 'entrance');
    applied.declare('slide-in', 'segment', given([SLIDE, em(1.5)]), ['tscaps-slide-in'], 'entrance');

    expect(applied.declared()).toEqual([
      { id: 'slide-in', element: 'segment', values: { [SLIDE]: em(1.5) }, keyframes: ['tscaps-slide-in'] },
    ]);
  });

  it('stays two answers when it lands on two elements', () => {
    const applied = registry();

    applied.declare('rise-in', 'segment', given([RISE, em(1)]), ['tscaps-rise-in'], 'entrance');
    applied.declare('rise-in', 'word', given([RISE, em(2)]), ['tscaps-rise-in'], 'entrance');

    expect(applied.declared().map((animation) => animation.element)).toEqual(['segment', 'word']);
  });

  it('keeps a value both call sites gave the same way', () => {
    const applied = registry();

    applied.declare('slide-in', 'segment', given([SLIDE, em(0)]), ['tscaps-slide-in'], 'entrance');
    applied.declare('slide-in', 'segment', given([SLIDE, em(0)]), ['tscaps-slide-in'], 'entrance');

    expect(applied.declared()[0]?.values).toEqual({ [SLIDE]: em(0) });
  });

  it('drops a value the call sites gave two ways', () => {
    const applied = registry();

    applied.declare('slide-in', 'segment', given([SLIDE, em(-1.5)]), ['tscaps-slide-in'], 'entrance');
    applied.declare('slide-in', 'segment', given([SLIDE, em(1.5)]), ['tscaps-slide-in'], 'entrance');

    expect(applied.declared()[0]?.values).toEqual({});
  });

  it('keeps the values they agreed on beside the one they did not', () => {
    const applied = registry();

    applied.declare('slide-in', 'segment', given([SLIDE, em(-1.5)], [RISE, em(0.2)]), ['tscaps-slide-in'], 'entrance');
    applied.declare('slide-in', 'segment', given([SLIDE, em(1.5)], [RISE, em(0.2)]), ['tscaps-slide-in'], 'entrance');

    expect(applied.declared()[0]?.values).toEqual({ [RISE]: em(0.2) });
  });

  it('keeps every block its call sites named, so an animation made of two is covered', () => {
    const applied = registry();

    applied.declare('typewriter', 'letter', given(), ['tscaps-letter-appear'], 'entrance');
    applied.declare('typewriter', 'letter', given(), ['tscaps-caret-window'], 'entrance');

    expect(applied.keyframeNames()).toEqual(new Set(['tscaps-letter-appear', 'tscaps-caret-window']));
  });

  it('tells a value apart from one that only prints the same', () => {
    const applied = registry();

    applied.declare('fade-in', 'segment', given([RISE, em(1)]), ['tscaps-fade-in'], 'entrance');
    applied.declare('fade-in', 'segment', given([RISE, { kind: 'text', text: '1em' }]), ['tscaps-fade-in'], 'entrance');

    expect(applied.declared()[0]?.values).toEqual({});
  });
});
