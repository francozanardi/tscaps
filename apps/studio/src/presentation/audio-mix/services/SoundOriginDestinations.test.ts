import { describe, expect, it } from 'vitest';
import { SoundOriginDestinations, type SoundPageOwner } from '@presentation/audio-mix/services/SoundOriginDestinations';

const destinations = new SoundOriginDestinations();
const SHOT: SoundPageOwner = { kind: 'shot', shotId: 'shot-1' };
const LAYER: SoundPageOwner = { kind: 'layer', layerId: 'broll' };

describe('where a sound played by something else is changed', () => {
  it('opens a tab of the same inspector for what the page\'s own element plays: its camera, its layout transition', () => {
    expect(destinations.destinationOf({ kind: 'camera', shotId: 'shot-1' }, SHOT)).toMatchObject({ kind: 'tab', page: 'camera' });
    expect(destinations.destinationOf({ kind: 'layer-camera', layerId: 'broll' }, LAYER)).toMatchObject({ kind: 'tab', page: 'camera' });
    expect(destinations.destinationOf({ kind: 'layer-transition', layerId: 'broll', edge: 'exit' }, LAYER))
      .toMatchObject({ kind: 'tab', page: 'motion', transitionEdge: 'exit' });
  });

  it('opens a layer of the shot, or a word, on the page that plays it', () => {
    expect(destinations.destinationOf({ kind: 'layer', layerId: 'broll', edge: 'entry' }, SHOT)).toMatchObject({ kind: 'layer', layerId: 'broll', page: 'sound' });
    expect(destinations.destinationOf({ kind: 'layer-transition', layerId: 'broll', edge: 'entrance' }, SHOT)).toMatchObject({ kind: 'layer', page: 'motion' });
    expect(destinations.destinationOf({ kind: 'layer-camera', layerId: 'broll' }, SHOT)).toMatchObject({ kind: 'layer', page: 'camera' });
    expect(destinations.destinationOf({ kind: 'word', wordId: 'w-1', edge: 'start' }, SHOT)).toMatchObject({ kind: 'word', wordId: 'w-1' });
  });

  it('opens the transition into the shot beside the shot', () => {
    expect(destinations.destinationOf({ kind: 'transition', shotId: 'shot-1' }, SHOT)).toMatchObject({ kind: 'shot-transition', shotId: 'shot-1' });
  });

  it('goes nowhere for a sound already on the page\'s element', () => {
    expect(destinations.destinationOf({ kind: 'shot', shotId: 'shot-1', edge: 'start' }, SHOT)).toBeNull();
    expect(destinations.destinationOf({ kind: 'layer', layerId: 'broll', edge: 'exit' }, LAYER)).toBeNull();
  });
});
