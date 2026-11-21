import { describe, expect, it } from 'vitest';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import { TemplateAnimationAnswerResolver } from '@core/templates/services/animations/TemplateAnimationAnswerResolver';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';

/**
 * Which card the picker should already be showing as chosen.
 *
 * A sheet has nothing above it, so "as the template has it" is a fact
 * this panel can look up rather than a deferral. Naming the movement
 * beats naming where it came from, and where the template moves
 * nothing the honest card is "None" — the picker's word for exactly
 * that. What is left for the template's own card is movement the
 * picker cannot name, which is the only case a reader learns anything
 * from it.
 */

const CAPTION_KINDS = ['segment', 'line', 'word', 'decoration'];
const ENTRANCE_CLOCKS = ['--on-segment-starts', '--on-line-being-narrated-starts', '--on-word-being-narrated-starts'];
const EXIT_CLOCKS = ['--on-segment-ends'];

/** A card compiled for every caption kind on the clocks of one end. */
const preset = (id: string, clocks = ENTRANCE_CLOCKS) => ({
  id,
  kinds: CAPTION_KINDS,
  declarationsByTimingVariable: Object.fromEntries(clocks.map((clock) => [clock, ''])),
}) as unknown as ElementAnimationPreset;
const catalog = new ElementAnimationCatalog([preset('rise-in'), preset('fade-in'), preset('fade-out', EXIT_CLOCKS)]);
const resolver = new TemplateAnimationAnswerResolver(catalog, new ElementTimingVariableResolver());

const on = (id: string, element: DeclaredAnimation['element'], end?: DeclaredAnimation['end']): DeclaredAnimation =>
  ({ id, element, values: {}, keyframes: [`tscaps-${id}`], ...(end ? { end } : {}) });

function applying(...declared: DeclaredAnimation[]): DeclaredAnimation[] {
  return declared;
}

describe('what a template already does to a kind', () => {
  it('is the entrance it applied, when the picker has that card', () => {
    const applied = applying(on('rise-in', 'word'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'named', presetId: 'rise-in' });
  });

  it('is unnamed when it moves the kind with something the picker does not offer', () => {
    const applied = applying(on('settle-in', 'segment'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'unnamed' });
  });

  it('is unnamed when it gave the kind two, since picking one would deny the other', () => {
    const applied = applying(on('rise-in', 'word'), on('fade-in', 'word'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'unnamed' });
  });

  it('is still when it moves that kind with nothing at all', () => {
    const applied = applying(on('rise-in', 'segment'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'still' });
  });

  it('is still for a template that moves nothing anywhere', () => {
    expect(resolver.answerFor([], ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'still' });
    expect(resolver.answerFor([], ElementAnimationScope.WORDS)).toEqual({ kind: 'still' });
    expect(resolver.answerFor([], ElementAnimationScope.EMOJIS)).toEqual({ kind: 'still' });
  });

  it('reads each kind on its own when the template moves several', () => {
    const applied = applying(on('rise-in', 'segment'), on('fade-in', 'word'), on('hype-emoji-enter', 'decoration'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'named', presetId: 'rise-in' });
    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'named', presetId: 'fade-in' });
    expect(resolver.answerFor(applied, ElementAnimationScope.EMOJIS)).toEqual({ kind: 'unnamed' });
  });

  // A caption whose letters type is a caption whose words hold still:
  // the panel answers for one kind, and nothing here moves the words.
  // Letters and lines have no panel of their own to say otherwise.
  it('is still for a kind whose only movement sits on a node no scope reaches', () => {
    const applied = applying(on('rise-in', 'line'), on('typewriter', 'letter'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'still' });
    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'still' });
  });

  it('files a card under the end it plays at, so an entrance leaves the exit still', () => {
    const applied = applying(on('rise-in', 'word'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS_EXIT)).toEqual({ kind: 'still' });
  });

  it('names an exit card at the exit and leaves the entrance still', () => {
    const applied = applying(on('fade-out', 'segment', 'exit'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS_EXIT)).toEqual({ kind: 'named', presetId: 'fade-out' });
    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'still' });
  });

  // An animation declared without an end is the template's motion as a
  // whole, shown where that has always been read.
  it('reads a bespoke motion as the entrance, and the exit as still', () => {
    const applied = applying(on('slap', 'word'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'unnamed' });
    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS_EXIT)).toEqual({ kind: 'still' });
  });

  it('reads a bespoke exit the template declared as its own answer at the exit', () => {
    const applied = applying(on('slap', 'word'), on('drop-out', 'word', 'exit'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS_EXIT)).toEqual({ kind: 'unnamed' });
    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS_EXIT)).toEqual({ kind: 'still' });
  });
});
