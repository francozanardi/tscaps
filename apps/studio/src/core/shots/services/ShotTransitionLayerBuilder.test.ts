import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { RenderTimeMap } from '@tscaps/engine';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotTransitionLayerBuilder } from '@core/shots/services/ShotTransitionLayerBuilder';

/**
 * Where each transition between shots plays on the output: over its
 * cut, half before and half after, in output time, above everything,
 * drawing the frame beneath it again.
 */

const builder = new ShotTransitionLayerBuilder(new ShotTransitionCuts());

function partition(shots: ReadonlyArray<{ id: string; startSec: number; durationSec?: number }>): ShotPartition {
  return ShotPartition.fromSnapshot({
    maxShotSec: 4,
    shots: shots.map(({ id, startSec, durationSec }) => ({
      id,
      startSec,
      ...(durationSec === undefined ? {} : { transition: { kind: 'flash' as const, durationSec } }),
    })),
  });
}

describe('the transitions between shots', () => {
  it('play over each cut that has one, centred on it, drawing the frame beneath them', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2, durationSec: 0.5 }, { id: 'c', startSec: 5 }]), new RenderTimeMap([]), 8);

    expect(built.map(({ footage }) => footage)).toEqual([{
      id: 'shot-transition:b', source: { kind: 'backdrop' }, outputStartSec: 1.75, outputEndSec: 2.25, sourceStartSec: 0, sourcePassSec: Infinity,
    }]);
    expect(built[0]!.staged).toEqual({ layerId: 'shot-transition:b', kind: 'flash', durationSec: 0.5, clippedSec: 0 });
  });

  it('play on output time, after the cuts before them collapse', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 4, durationSec: 1 }]), new RenderTimeMap([{ startSec: 1, endSec: 2 }]), 10);

    expect(built[0]!.footage).toMatchObject({ outputStartSec: 2.5, outputEndSec: 3.5 });
  });

  it('are cut short at either end of the output, their timing saying how much of the first half is gone', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 0.2, durationSec: 1 }, { id: 'c', startSec: 7.8, durationSec: 1 }]), new RenderTimeMap([]), 8);

    expect(built.map(({ footage }) => [footage.outputStartSec, footage.outputEndSec])).toEqual([[0, 0.7], [7.3, 8]]);
    expect(built[0]!.staged.clippedSec).toBeCloseTo(0.3, 9);
    expect(built[1]!.staged.clippedSec).toBe(0);
  });

  it('leave out a shot that opens where the one before it already did, everything between them being cut', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2, durationSec: 0.5 }, { id: 'c', startSec: 3, durationSec: 0.5 }]), new RenderTimeMap([{ startSec: 1.5, endSec: 3.5 }]), 10);

    expect(built.map(({ footage }) => footage.id)).toEqual(['shot-transition:b']);
  });

  it('play the next one at that cut where the shot cut away has none, between the shots around it', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2 }, { id: 'c', startSec: 3, durationSec: 0.5 }]), new RenderTimeMap([{ startSec: 2, endSec: 3 }]), 10);

    expect(built.map(({ footage }) => [footage.id, footage.outputStartSec, footage.outputEndSec])).toEqual([['shot-transition:c', 1.75, 2.25]]);
  });

  it('run whole over a shot cut short after them, into the ones that follow', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2, durationSec: 1 }, { id: 'c', startSec: 3 }]), new RenderTimeMap([{ startSec: 2, endSec: 2.9 }]), 10);

    expect(built.map(({ footage }) => [footage.outputStartSec, footage.outputEndSec])).toEqual([[1.5, 2.5]]);
  });

  it('play none at the output\'s start, where everything before the shot is cut', () => {
    const built = builder.build(partition([{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2, durationSec: 0.5 }]), new RenderTimeMap([{ startSec: 0, endSec: 2 }]), 10);

    expect(built).toEqual([]);
  });
});
