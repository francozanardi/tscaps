import { describe, expect, it } from 'vitest';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerSplitTransitionForm } from '@presentation/shots/services/ShotLayerSplitTransitionForm';

const form = new ShotLayerSplitTransitionForm(new ShotLayerSplitTransitions());

describe('ShotLayerSplitTransitionForm', () => {
  it('is offered only while every layer edited splits the frame', () => {
    expect(form.isOffered(['split', 'split'])).toBe(true);
    expect(form.isOffered(['split', 'inset'])).toBe(false);
    expect(form.isOffered([])).toBe(false);
  });

  it('shows a layer with nothing recorded sliding over half a second', () => {
    expect(form.viewOf([undefined], 'entrance')).toEqual({ kind: 'slide', isKindMixed: false, durationSec: 0.5, isDurationMixed: false });
  });

  it('shows the first layer\'s transition, mixed where the others differ', () => {
    const view = form.viewOf([
      { [ElementFieldId.SPLIT_EXIT]: '2', [ElementFieldId.SPLIT_EXIT_DURATION]: 1 },
      { [ElementFieldId.SPLIT_EXIT]: '0', [ElementFieldId.SPLIT_EXIT_DURATION]: 1 },
    ], 'exit');

    expect(view).toEqual({ kind: 'reveal', isKindMixed: true, durationSec: 1, isDurationMixed: false });
  });
});
