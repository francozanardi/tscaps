import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { describe, expect, it } from 'vitest';
import { PlaceMediaOperation } from '@core/editor-operations/services/descriptors/PlaceMediaOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';

function operationOn(fixture: ShotOperationsFixture): PlaceMediaOperation {
  return new PlaceMediaOperation(fixture.shotRefs, fixture.media, fixture.parser, fixture.actions.showFile, fixture.layerRuns);
}

function layersOf(fixture: ShotOperationsFixture, shotIndex: number): ShotFileLayer[] {
  return fixture.shot(shotIndex).shot.layers as ShotFileLayer[];
}

describe('place_media', () => {
  it('shows a file from its shot through a later one when asked to', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, media: 'pic', through: fixture.shot(2).ref });

    const [layer] = layersOf(fixture, 1);
    expect(result.output).toMatchObject({ through: fixture.shot(2).ref, shots: 2 });
    expect(fixture.store.snapshot().shots.runOf(layer!.id).map((shot) => shot.id)).toEqual([fixture.shot(1).shot.id, fixture.shot(2).shot.id]);
  });

  it('places nothing when asked to show through a shot before its own', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');

    const result = await operationOn(fixture).run({ shot: fixture.shot(2).ref, media: 'pic', through: fixture.shot(1).ref });

    expect(result.ok).toBe(false);
    expect(layersOf(fixture, 2)).toEqual([]);
  });

  it('puts a picture on the shot and answers the layer that shows it', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, media: 'pic' });

    const [layer] = layersOf(fixture, 1);
    expect(layer?.mediaId).toBe('pic');
    expect(result).toEqual({ ok: true, output: { layer: `layer:${layer?.id}`, type: 'image', shot: fixture.shot(1).ref }, problems: [] });
  });

  it('shows a video in place of the b-roll the shot has, answering that layer', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('clip', 'video');
    fixture.addFile('other-clip', 'video');
    const shot = fixture.shot(1).ref;
    const first = await operationOn(fixture).run({ shot, media: 'clip' });

    const second = await operationOn(fixture).run({ shot, media: 'other-clip' });

    expect(layersOf(fixture, 1).map((layer) => layer.mediaId)).toEqual(['other-clip']);
    expect(second.output).toEqual({ layer: (first.output as { layer: string }).layer, type: 'video', shot });
    expect(second.problems).toEqual([expect.objectContaining({ severity: 'warning' })]);
  });

  it('refuses a file it does not know and a sound, changing nothing', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('song', 'audio');
    const before = fixture.store.snapshot();

    const unknown = await operationOn(fixture).run({ shot: fixture.shot(1).ref, media: 'nope' });
    const sound = await operationOn(fixture).run({ shot: fixture.shot(1).ref, media: 'song' });

    expect([unknown.ok, sound.ok]).toEqual([false, false]);
    expect(sound.problems[0]?.message).toContain('add_sounds');
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('answers a GIF this browser cannot play with a problem instead of failing', async () => {
    const fixture = new ShotOperationsFixture({ ensurePlayable: async () => { throw new Error('No decoder here can read this GIF.'); } });
    fixture.addFile('loop', 'gif');
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, media: 'loop' });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot()).toBe(before);
  });
});
