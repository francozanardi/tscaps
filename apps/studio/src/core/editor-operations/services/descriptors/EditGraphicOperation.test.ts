import { describe, expect, it } from 'vitest';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { AddGraphicOperation } from '@core/editor-operations/services/descriptors/AddGraphicOperation';
import { EditGraphicOperation } from '@core/editor-operations/services/descriptors/EditGraphicOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';

function operationOn(fixture: ShotOperationsFixture): EditGraphicOperation {
  return new EditGraphicOperation(
    fixture.store,
    fixture.shotRefs,
    fixture.parser,
    fixture.fieldsCheck,
    fixture.documentCheck,
    fixture.actions.setGraphic,
    fixture.actions.setLayerPlacement,
    fixture.playback,
  );
}

/** A graphic written from nothing with two fields set, a box, an exit and a sound on its moment, on the second shot. */
async function graphicOn(fixture: ShotOperationsFixture): Promise<string> {
  const added = await new AddGraphicOperation(
    fixture.shotRefs, fixture.parser, fixture.graphicPresets, fixture.customGraphics, fixture.fieldsCheck, fixture.actions.addGraphic, fixture.playback, fixture.layerRuns,
  ).run({
    shot: fixture.shot(1).ref,
    graphic: {
      html: '<p></p>',
      css: 'p { font-size: 40vh; }',
      js: "tscaps.moment('pop', 0.5, 'Pops');\ndocument.querySelector('p').textContent = tscaps.params.title + tscaps.params.size;",
      fields: [
        { id: 'title', label: 'Title', kind: 'text', defaultValue: 'Title' },
        { id: 'size', label: 'Size', kind: 'number', defaultValue: 10 },
      ],
      aspectRatio: 4,
      box: { kind: 'box', centerX: 0.5, centerY: 0.7, width: 0.8 },
      motion: { exit: { animation: 'layer-fade-exit', duration: 0.3 } },
      sounds: [{ moment: 'pop', sound: 'pop-bubble', volume: 0.3 }],
    },
    params: { title: 'Ada', size: 12 },
  });
  return (added.output as { layer: string }).layer.slice('layer:'.length);
}

describe('edit_graphic', () => {
  it('keeps the captions off its shot, and shows them again', async () => {
    const fixture = new ShotOperationsFixture();
    const layerId = await graphicOn(fixture);

    const hidden = await operationOn(fixture).run({ layer: `layer:${layerId}`, hidesCaptions: true });
    const hiding = fixture.graphicOf(layerId)?.hidesCaptions;
    const shown = await operationOn(fixture).run({ layer: `layer:${layerId}`, hidesCaptions: false });

    expect(hidden.output).toMatchObject({ changed: ['hidesCaptions'], hidesCaptions: true });
    expect(hiding).toBe(true);
    expect(shown.output).toMatchObject({ changed: ['hidesCaptions'], hidesCaptions: false });
    expect(fixture.graphicOf(layerId)?.hidesCaptions).toBe(false);
  });

  it('rewrites a part of the code and a field\'s value as the Code and Content tabs do', async () => {
    const fixture = new ShotOperationsFixture();
    const layerId = await graphicOn(fixture);

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, css: 'p { color: #fff; }', params: { title: 'Grace' } });

    expect(result.output).toMatchObject({ changed: ['css', 'params.title'] });
    expect(fixture.graphicOf(layerId)).toMatchObject({ document: { css: 'p { color: #fff; }' }, params: { title: 'Grace', size: 12 } });
  });

  it('plays the graphic again after its code changed and says when it drew nothing', async () => {
    const fixture = new ShotOperationsFixture();
    const layerId = await graphicOn(fixture);
    const emptyPicture = { close: () => undefined } as unknown as ImageBitmap;
    fixture.graphicChecker.answer({ frames: [{ sec: 0.1, bitmap: emptyPicture, drawnShare: 0, paintedShare: 0, error: null, text: null }] });

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, css: 'p { color: transparent; }' });

    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('drew nothing') })]);
  });

  it('says when a graphic laid out over the whole frame no longer fills it, and nothing when it does', async () => {
    const fixture = new ShotOperationsFixture();
    const layerId = await graphicOn(fixture);
    fixture.actions.setLayerPlacement.execute(layerId, { kind: 'full', fit: 'cover' });
    const picture = { close: () => undefined } as unknown as ImageBitmap;
    fixture.graphicChecker.answer({ frames: [{ sec: 1.2, bitmap: picture, drawnShare: 0.1, paintedShare: 0.1, error: null, text: null }] });

    const sticker = await operationOn(fixture).run({ layer: `layer:${layerId}`, css: 'p { color: #fff; }' });

    expect(sticker.ok).toBe(true);
    expect(sticker.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('inset box') })]);

    fixture.graphicChecker.answer({ frames: [{ sec: 1.2, bitmap: picture, drawnShare: 1, paintedShare: 1, error: null, text: null }] });

    const scene = await operationOn(fixture).run({ layer: `layer:${layerId}`, css: 'body { background: #111; }' });

    expect(scene.problems).toEqual([]);
  });

  it('redeclares its fields and shape, keeping the values that still fit, its layout, its exit and the sound on its moment', async () => {
    const fixture = new ShotOperationsFixture();
    const layerId = await graphicOn(fixture);
    const box = fixture.store.snapshot().shots.placementOf(layerId);
    if (box.kind !== 'inset') throw new Error('The graphic starts in its box.');
    fixture.actions.setLayerPlacement.execute(layerId, { ...box, padding: 0.1, cornerRadius: 0.05 });
    const placement = fixture.store.snapshot().shots.placementOf(layerId);
    const fields = [
      { id: 'title', label: 'Title', kind: 'text', defaultValue: 'Title' },
      { id: 'accent', label: 'Accent', kind: 'color', defaultValue: '#ffffff' },
    ];

    const result = await operationOn(fixture).run({ layer: `layer:${layerId}`, fields, aspectRatio: 2 });

    const state = fixture.store.snapshot();
    expect(fixture.graphicOf(layerId)).toMatchObject({ fields, params: { title: 'Ada' }, aspectRatio: 2 });
    expect(state.shots.placementOf(layerId)).toEqual(placement);
    expect(state.shots.layerStyles.animationOf(layerId, ElementAnimationScope.EXIT)?.presetId).toBe('layer-fade-exit');
    expect(state.audio.clips().map(({ source, start, volume }) => [source, start.anchor, volume])).toEqual([
      [{ kind: 'builtin', soundId: 'pop-bubble' }, { kind: 'layer-moment', layerId, momentId: 'pop' }, 0.3],
    ]);
    expect(result.problems.map((problem) => problem.severity)).toEqual(['warning', 'warning', 'warning']);
  });

  it('refuses a file layer and a value its field cannot hold, changing nothing', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    await fixture.actions.showFile.execute(fixture.shot(2).shot.id, 'pic', 'assistant');
    const pictureId = fixture.shot(2).shot.layers[0]!.id;
    const layerId = await graphicOn(fixture);
    const before = fixture.store.snapshot();

    const onFile = await operationOn(fixture).run({ layer: `layer:${pictureId}`, css: 'p {}' });
    const wrongKind = await operationOn(fixture).run({ layer: `layer:${layerId}`, params: { size: 'big' } });
    const unknownField = await operationOn(fixture).run({ layer: `layer:${layerId}`, params: { nothing: 1 } });

    expect([onFile.ok, wrongKind.ok, unknownField.ok]).toEqual([false, false, false]);
    expect(fixture.store.snapshot()).toBe(before);
  });
});
