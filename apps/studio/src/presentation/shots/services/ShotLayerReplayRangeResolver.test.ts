import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@tscaps/engine';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerReplayRangeResolver } from '@presentation/shots/services/ShotLayerReplayRangeResolver';

/** A picture over the shot from 2 s to 8 s of a 10 s video. */
const shots = ShotPartition.fromSnapshot({
  maxShotSec: 6,
  shots: [
    { id: 'a', startSec: 0 },
    { id: 'b', startSec: 2, layers: [{ id: 'logo', mediaId: 'logo', inSec: 0, outSec: null, loop: false }] },
    { id: 'c', startSec: 8 },
  ],
});
const resolver = new ShotLayerReplayRangeResolver(new ShotLayerTiming(new ShotLayerAssetReader()));
const range = (edge: 'entrance' | 'exit', edgeSec: number) =>
  resolver.resolve('logo', edge, edgeSec, shots, MediaAssetCatalog.empty(), new RenderTimeMap([]), 10);

describe('ShotLayerReplayRangeResolver', () => {
  it('plays an entrance from the layer\'s start to a moment after it settles', () => {
    const entrance = range('entrance', 0.4)!;

    expect(entrance.startSec).toBe(2);
    expect(entrance.endSec).toBeCloseTo(2.5, 9);
  });

  it('plays an exit from a moment before it starts to the layer\'s last frame', () => {
    const exit = range('exit', 1)!;

    expect(exit.startSec).toBeCloseTo(8 - 1 / 60 - 1.1, 6);
    expect(exit.endSec).toBeCloseTo(8 - 1 / 60, 6);
  });

  it('takes a motion longer than half the layer as half of it, as the layer plays it', () => {
    const entrance = range('entrance', 30)!;

    expect(entrance.startSec).toBe(2);
    expect(entrance.endSec).toBeCloseTo(5.1, 9);
  });

  it('plays the whole layer from its start to its last frame', () => {
    const whole = resolver.wholeOf('logo', shots, MediaAssetCatalog.empty(), new RenderTimeMap([]), 10)!;

    expect(whole.startSec).toBe(2);
    expect(whole.endSec).toBeCloseTo(8 - 1 / 60, 9);
  });

  it('plays a whole shot through its own video', () => {
    const whole = resolver.wholeOf(ShotVideoLayerId.of('c'), shots, MediaAssetCatalog.empty(), new RenderTimeMap([]), 10)!;

    expect(whole.startSec).toBe(8);
    expect(whole.endSec).toBeCloseTo(10 - 1 / 60, 9);
  });

  it('answers nothing for a layer no shot holds', () => {
    expect(resolver.resolve('gone', 'entrance', 1, shots, MediaAssetCatalog.empty(), new RenderTimeMap([]), 10)).toBeNull();
  });
});
