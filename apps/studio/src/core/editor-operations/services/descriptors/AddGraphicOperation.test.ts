import { describe, expect, it } from 'vitest';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { AddGraphicOperation } from '@core/editor-operations/services/descriptors/AddGraphicOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';

function operationOn(fixture: ShotOperationsFixture): AddGraphicOperation {
  return new AddGraphicOperation(fixture.shotRefs, fixture.parser, fixture.graphicPresets, fixture.customGraphics, fixture.fieldsCheck, fixture.actions.addGraphic, fixture.playback, fixture.layerRuns);
}

const BADGE = {
  html: '<div class="badge"><span class="label"></span></div>',
  css: '.badge { width: 100vw; height: 100vh; background: var(--accent); }',
  js: "const PRESS = 0.8;\ntscaps.moment('pop', PRESS, 'Pops');\ndocument.querySelector('.label').textContent = tscaps.params.label;\ntscaps.render = (t) => {};",
  fields: [
    { id: 'label', label: 'Label', kind: 'text', defaultValue: 'New' },
    { id: 'accent', label: 'Accent', kind: 'color', defaultValue: '#ffd400' },
  ],
  aspectRatio: 3,
  box: { kind: 'box', centerX: 0.5, centerY: 0.8, width: 0.6 },
  motion: { exit: { animation: 'layer-fade-exit', duration: 0.3 } },
  sounds: [{ moment: 'pop', sound: 'pop-bubble' }],
};

/** The layer id a result answered. */
function layerIdOf(output: unknown): string {
  return (output as { layer: string }).layer.slice('layer:'.length);
}

describe('add_graphic', () => {
  it('puts one graphic over several shots when given the last shot it shows on', async () => {
    const fixture = new ShotOperationsFixture();

    const result = await operationOn(fixture).run({ shot: fixture.shot(0).ref, through: fixture.shot(2).ref, graphic: BADGE });

    expect(result.output).toMatchObject({ shot: fixture.shot(0).ref, through: fixture.shot(2).ref, shots: 3 });
    const shots = fixture.store.snapshot().shots;
    expect(shots.list().flatMap((shot) => shot.layers).map((layer) => layer.id)).toEqual([layerIdOf(result.output)]);
    expect(shots.layersContinuingInto(fixture.shot(2).shot.id).map((layer) => layer.id)).toEqual([layerIdOf(result.output)]);
  });

  it('says when a preset keeps the captions off its shot, and keeps them when asked to', async () => {
    const fixture = new ShotOperationsFixture();
    const hook = fixture.graphicPresets.list().find((preset) => preset.graphic.hidesCaptions)!;

    const asShipped = await operationOn(fixture).run({ shot: fixture.shot(0).ref, preset: hook.id });
    const keepingCaptions = await operationOn(fixture).run({ shot: fixture.shot(1).ref, preset: hook.id, hidesCaptions: false });

    expect(asShipped.output).toMatchObject({ hidesCaptions: true });
    expect(fixture.graphicOf(layerIdOf(asShipped.output))?.hidesCaptions).toBe(true);
    expect(keepingCaptions.output).toMatchObject({ hidesCaptions: false });
    expect(fixture.graphicOf(layerIdOf(keepingCaptions.output))?.hidesCaptions).toBe(false);
  });

  it('puts a preset on the shot with its fields set, in one undo step', async () => {
    const fixture = new ShotOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, preset: 'lower-third', params: { title: 'Ada', accent: '#ff3b5c' } });

    const layerId = layerIdOf(result.output);
    expect(result.output).toMatchObject({ preset: 'lower-third', fields: ['title', 'subtitle', 'accent'], aspectRatio: 4 });
    expect(fixture.graphicOf(layerId)?.params).toEqual({ title: 'Ada', accent: '#ff3b5c' });
    expect(fixture.store.snapshot().shots.shotHolding(layerId)?.id).toBe(fixture.shot(1).shot.id);
    fixture.store.undo();
    expect(fixture.store.snapshot().shots).toBe(before.shots);
  });

  it('plays the graphic it added and says when its code threw or it drew nothing, keeping the graphic', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.graphicChecker.answer({
      messages: [{ level: 'error', text: 'TypeError: tscaps.params.title is undefined' }],
      frames: [{ sec: 0.1, bitmap: null, drawnShare: 0, paintedShare: 0, error: 'render threw', text: null }],
    });

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, graphic: BADGE });

    const layerId = layerIdOf(result.output);
    expect(result.ok).toBe(true);
    expect(fixture.graphicChecker.checkedLayerIds).toEqual([layerId]);
    expect(result.problems).toEqual([
      expect.objectContaining({ severity: 'warning', ref: `layer:${layerId}`, message: expect.stringContaining('tscaps.params.title is undefined') }),
    ]);
    expect(fixture.graphicOf(layerId)).not.toBeNull();
  });

  it('says when the text of the graphic it added is cut by its box once landed, keeping the graphic', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.graphicChecker.answer({
      frames: [{ sec: 1.2, bitmap: null, drawnShare: 0.2, paintedShare: 0, error: null, text: { smallest: { text: 'Hi', px: 60 }, cut: ['a label far too long'] } }],
    });

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, graphic: BADGE });

    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([
      expect.objectContaining({ severity: 'warning', message: expect.stringContaining('text is cut by its box or by an element that clips it: "a label far too long"') }),
    ]);
  });

  it('puts a graphic written from nothing on the shot as a preset would: its box, its exit and its sounds', async () => {
    const fixture = new ShotOperationsFixture();

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, graphic: BADGE, params: { label: 'Hi' } });

    const layerId = layerIdOf(result.output);
    const shots = fixture.store.snapshot().shots;
    expect(result.problems).toEqual([]);
    expect(fixture.graphicOf(layerId)).toMatchObject({
      document: { html: BADGE.html, css: BADGE.css, js: BADGE.js },
      fields: BADGE.fields,
      params: { label: 'Hi' },
      aspectRatio: 3,
    });
    expect(shots.placementOf(layerId)).toMatchObject({ kind: 'inset', centerX: 0.5, centerY: 0.8, width: 0.6 });
    expect(shots.layerStyles.animationOf(layerId, ElementAnimationScope.EXIT)).toEqual({ presetId: 'layer-fade-exit', params: { duration: 0.3 } });
    expect(fixture.store.snapshot().audio.clips().map(({ source, start, volume }) => [source, start.anchor, volume])).toEqual([
      [{ kind: 'builtin', soundId: 'pop-bubble' }, { kind: 'layer-moment', layerId, momentId: 'pop' }, 0.15],
    ]);
  });

  it('refuses what the editor would drop or the network would serve, changing nothing', async () => {
    const fixture = new ShotOperationsFixture();
    const shot = fixture.shot(1).ref;
    const before = fixture.store.snapshot();
    const refused = [
      { shot, preset: 'nope' },
      { shot, preset: 'lower-third', graphic: BADGE },
      { shot, preset: 'lower-third', params: { nothing: 'x' } },
      { shot, preset: 'lower-third', params: { accent: 'red' } },
      { shot, graphic: { ...BADGE, css: '.badge { background: url(https://example.com/a.png); }' } },
      { shot, graphic: { ...BADGE, fields: [{ id: 'accent', label: 'Accent', kind: 'color', defaultValue: 7 }] } },
      { shot, graphic: { ...BADGE, motion: { exit: 'layer-fade-entrance' } } },
      { shot, graphic: { ...BADGE, motion: { exit: { animation: 'layer-fade-exit', duration: 9 } } } },
      { shot, graphic: { ...BADGE, sounds: [{ moment: 'pop', sound: 'nope' }] } },
      { shot: 'shot:gone', preset: 'lower-third' },
    ];

    const results = await Promise.all(refused.map((input) => operationOn(fixture).run(input)));

    expect(results.map((result) => result.ok)).toEqual(refused.map(() => false));
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('adds a graphic whose code reaches for the network or reads an undeclared field, and says so', async () => {
    const fixture = new ShotOperationsFixture();
    const js = "fetch('https://example.com');\ntscaps.render = () => { document.body.textContent = tscaps.params.missing; };";

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, graphic: { html: '', css: '', js } });

    expect(result.ok).toBe(true);
    expect(result.problems.map((problem) => problem.severity)).toEqual(['warning', 'warning']);
    expect(result.problems.map((problem) => problem.message).join(' ')).toContain('tscaps.params.missing');
  });

  it('says which fonts it names that tscaps does not have, and takes the ones it has', async () => {
    const fixture = new ShotOperationsFixture();
    const graphic = {
      html: '<p style="font-family: Impact, sans-serif">A</p><b>B</b>',
      css: "p { font-family: 'Anton', sans-serif; } b { font-family: \"Inter\", system-ui; } i { font-family: Georgia, serif; } .e { font-family: 'Apple Color Emoji'; } .v { font-family: var(--font, 'Nope'); }",
      js: '',
    };

    const result = await operationOn(fixture).run({ shot: fixture.shot(1).ref, graphic });

    expect(result.ok).toBe(true);
    expect(result.problems.map((problem) => problem.message)).toEqual([
      expect.stringMatching(/^css: 'Georgia' is not a font tscaps has/),
      expect.stringMatching(/^html: 'Impact' is not a font tscaps has/),
    ]);
  });
});
