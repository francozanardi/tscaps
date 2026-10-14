import { describe, expect, it } from 'vitest';
import { CaptionBlendMode, CaptionStacking, Line, Segment, TimeFragment, Word } from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementBlendResolver } from '@core/elements/services/ElementBlendResolver';
import { SegmentSubtreeOverridesBuilder } from '@core/captions/services/SegmentSubtreeOverridesBuilder';

/**
 * The overrides the preview and the export both hand the renderer's
 * decomposer for one segment — so what they are is what both paint.
 */

const builder = new SegmentSubtreeOverridesBuilder(new ElementBlendResolver());
const segment = new Segment({
  id: 's1',
  lines: [new Line({ id: 'l1', words: ['w1', 'w2'].map((id, i) => new Word({ id, text: id, time: new TimeFragment(i, i + 1) })) })],
});

describe('a word under the top layer while its scene is not', () => {
  it('is painted apart under it, and its scene over it', () => {
    const overrides = builder.build(segment, ElementStyles.empty(), new Set(['w2']));
    expect(overrides.segment).toEqual({ stacking: CaptionStacking.OVER_TOP_LAYER });
    expect(overrides.subtree.get('w2')).toEqual({ stacking: CaptionStacking.UNDER_TOP_LAYER });
    expect(overrides.subtree.get('w1')).toBeUndefined();
  });

  it('keeps its blend there', () => {
    const blended = ElementStyles.empty().withBlend('w2', 'word', 'difference');
    expect(builder.build(segment, blended, new Set(['w2'])).subtree.get('w2')).toEqual({ blendMode: CaptionBlendMode.DIFFERENCE, stacking: CaptionStacking.UNDER_TOP_LAYER });
  });

  // The rest of the scene paints over the cutout, and a blend there
  // composites against the cutout like it would against the video.
  it('leaves a blend on a neighbour, which paints over the top layer with its scene', () => {
    const blended = ElementStyles.empty().withBlend('w1', 'word', 'difference');
    const overrides = builder.build(segment, blended, new Set(['w2']));
    expect(overrides.subtree.get('w1')).toEqual({ blendMode: CaptionBlendMode.DIFFERENCE });
    expect(overrides.segment).toEqual({ stacking: CaptionStacking.OVER_TOP_LAYER });
  });

  it('carries the stacking and the blend of a blended scene together on the scene', () => {
    const blended = ElementStyles.empty().withBlend('s1', 'segment', 'difference');
    const overrides = builder.build(segment, blended, new Set(['w2']));
    expect(overrides.segment).toEqual({ blendMode: CaptionBlendMode.DIFFERENCE, stacking: CaptionStacking.OVER_TOP_LAYER });
  });
});

describe('a segment with nothing under the top layer', () => {
  it('leaves the stacking to the renderer, which stacks everything under the top layer', () => {
    expect(builder.build(segment, ElementStyles.empty(), new Set()).segment).toBeUndefined();
  });
});
