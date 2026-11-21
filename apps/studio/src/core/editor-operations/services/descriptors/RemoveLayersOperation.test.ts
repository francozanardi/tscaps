import { describe, expect, it } from 'vitest';
import { RemoveLayersOperation } from '@core/editor-operations/services/descriptors/RemoveLayersOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';

function operationOn(fixture: ShotOperationsFixture): RemoveLayersOperation {
  return new RemoveLayersOperation(fixture.store, fixture.shotRefs, fixture.parser, fixture.actions.removeLayers);
}

describe('remove_layers', () => {
  it('removes the layers named, wherever they are, and answers a ref that names none with a problem', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    await fixture.actions.showFile.execute(fixture.shot(1).shot.id, 'pic', 'assistant');
    const graphicId = fixture.actions.addGraphic.execute(fixture.shot(3).shot.id, fixture.graphicPresets.starter())!;
    const pictureId = fixture.shot(1).shot.layers[0]!.id;

    const result = await operationOn(fixture).run({ layers: [`layer:${graphicId}`, 'layer:gone'] });

    const shots = fixture.store.snapshot().shots;
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ removed: [`layer:${graphicId}`] });
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'error', ref: 'layer:gone' })]);
    expect(shots.findLayer(graphicId)).toBeNull();
    expect(shots.findLayer(pictureId)).not.toBeNull();
  });

  it('changes nothing when no ref names a layer', async () => {
    const fixture = new ShotOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ layers: ['layer:gone', fixture.shot(1).ref] });

    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(2);
    expect(fixture.store.snapshot()).toBe(before);
  });
});
