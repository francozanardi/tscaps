import { describe, expect, it } from 'vitest';
import { Decoration, type Word } from '@tscaps/engine';
import { ReadOperationsFixture } from '@core/editor-operations/testing/ReadOperationsFixture';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';

/**
 * One element in full, by ref: what it is, where it sits and the style
 * it carries of its own. A ref that names nothing is refused with the
 * project left as it was.
 */
describe('get_element', () => {
  it('reads a word: its place, tags and emoji, and its own style with the inline picture described', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'word:w1' });
    const output = result.output as Record<string, unknown> & { style: { css: string; fields: unknown } };

    expect(result.ok).toBe(true);
    expect(output).toMatchObject({
      ref: 'word:w1',
      kind: 'word',
      text: 'Hello',
      startSec: 0,
      endSec: 0.5,
      sheet: 'sheet:main',
      segment: 'segment:s1',
      line: 'line:l1',
      speaker: 'A',
      tags: ['emphasis'],
    });
    expect(output.style.fields).toEqual({ 'font-size': 1.2 });
    expect(output.style.css).toContain('<image, 3 KB>');
    expect(output.style.css).not.toContain('base64');
  });

  it('reads a segment with its lines, its words and the animation it was given', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'segment:s2' });

    expect(result.output).toMatchObject({
      ref: 'segment:s2',
      text: 'second line',
      lines: [{ ref: 'line:l2', text: 'second line' }],
      words: [['word:w3', 'second', 2, 2.5], ['word:w4', 'line', 2.5, 3]],
      style: { animations: { self: { preset: 'pop-in', params: { duration: 0.5 } } } },
    });
  });

  it('reads a graphic layer with its preset, the values set and its last ten console lines', async () => {
    const fixture = new ReadOperationsFixture();
    for (let index = 1; index <= 12; index++) fixture.graphicMessages.record('card', { level: 'log', text: `tick ${index}` });

    const result = await fixture.getElement().run({ element: 'layer:card' });
    const output = result.output as { graphic: { console: string[] } };

    expect(result.output).toMatchObject({
      ref: 'layer:card',
      kind: 'layer',
      shot: 'shot:b',
      type: 'graphic',
      graphic: { preset: 'lower-third', params: { title: 'Ada Lovelace' } },
    });
    expect(output.graphic.console).toHaveLength(10);
    expect(output.graphic.console.at(-1)).toBe('log: tick 12');
  });

  it('reads a b-roll layer with its file and the stretch of it that plays', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'layer:broll' });

    expect(result.output).toMatchObject({
      type: 'video',
      file: { mediaId: 'clip', name: 'broll.mp4', durationSec: 5, width: 1920, height: 1080 },
      timing: { inSec: 1, outSec: null, loop: false },
      placement: { kind: 'full' },
    });
  });

  it('reads a shot with its transition, its layers and its own video\'s camera move', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'shot:b' });

    expect(result.output).toMatchObject({
      ref: 'shot:b',
      kind: 'shot',
      index: 1,
      startSec: 6,
      endSec: 12,
      transition: { kind: 'flash', durationSec: 0.4 },
      layers: [{ ref: 'layer:broll' }, { ref: 'layer:card' }],
      videoStyle: { animations: { camera: { preset: 'layer-punch-in-camera' } } },
    });
  });

  it('reads a sheet with its preset and every style control at the value it holds', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'sheet:main' });

    expect(result.output).toMatchObject({
      ref: 'sheet:main',
      kind: 'sheet',
      active: true,
      template: { id: 'ada', name: 'ada' },
      preset: 'Dark',
      presets: ['Light', 'Dark'],
      segments: 2,
      styleControls: [{ id: 'text-color', label: 'Text', kind: 'color', value: '#111111' }],
      cssOverride: null,
    });
  });

  it('answers a sheet\'s CSS and SVG filters as they apply now only when asked: its template\'s until edited', async () => {
    const fixture = new ReadOperationsFixture();
    const plain = await fixture.getElement().run({ element: 'sheet:main' });
    const asked = await fixture.getElement().run({ element: 'sheet:main', include: ['css', 'filtersSvg'] });
    fixture.store.patch({ sheets: fixture.store.snapshot().sheets.map((sheet) => sheet.with({ filtersSvgOverride: '<svg><filter id="mine"/></svg>' })) });
    const edited = await fixture.getElement().run({ element: 'sheet:main', include: ['filtersSvg'] });

    expect(plain.output).not.toHaveProperty('css');
    expect(asked.output).toMatchObject({ css: '.segment { color: var(--text-color); }', filtersSvg: '' });
    expect(edited.output).toMatchObject({ filtersSvg: '<svg><filter id="mine"/></svg>' });
    expect(edited.output).not.toHaveProperty('css');
  });

  it('refuses include on anything but a sheet', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'word:w1', include: ['css'] });

    expect(result.ok).toBe(false);
  });

  it('reads an emoji put behind the person, placed in the frame and blending with the video', async () => {
    const fixture = new ReadOperationsFixture();
    const state = fixture.store.snapshot();
    const placement = { verticalAlign: 'center', verticalOffset: 0.4, horizontalAlign: 'center', horizontalOffset: 0.25 } as const;
    fixture.store.patch({
      behindActorOverrides: state.behindActorOverrides.with('w2:d', 'force-on'),
      elementStyles: state.elementStyles.withPlacement('w2:d', 'decoration', placement).withBlend('w2:d', 'decoration', 'difference'),
    });

    const result = await fixture.getElement().run({ element: 'decoration:w2:d' });

    expect(result.output).toMatchObject({ word: 'word:w2', behindPerson: 'on', style: { placement, blend: 'difference' } });
  });

  it('reads no emoji on a word whose suggestion its caption would not show', async () => {
    const fixture = new ReadOperationsFixture();
    const document = fixture.store.snapshot().document!;
    const waving = (word: Word) => (word.id === 'w1' ? word.with({ decoration: new Decoration({ id: 'w1:d', glyph: '👋' }) }) : word);
    fixture.store.patch({ document: document.with({ sections: document.sections.map((section) => section.with({
      segments: section.segments.map((segment) => segment.with({ lines: segment.lines.map((line) => line.with({ words: line.words.map(waving) })) })),
    })) }) });

    const hello = await fixture.getElement().run({ element: 'word:w1' });
    const world = await fixture.getElement().run({ element: 'word:w2' });

    expect(hello.output).not.toHaveProperty('suggestedEmoji');
    expect(hello.output).not.toHaveProperty('decoration');
    expect(world.output).toMatchObject({ suggestedEmoji: '🔥' });
  });

  it('reads which effects a sheet has on, under the names set_caption_effects takes', async () => {
    const fixture = new ReadOperationsFixture();
    fixture.store.patch({ sheets: fixture.store.snapshot().sheets.map((sheet) => sheet.with({ effectConfigs: [
      { type: 'emoji', enabled: true, placement: 'word', size: 1, gap: 0.4 },
      { type: 'smart_lowercase', enabled: true },
      { type: 'remove_punctuation', enabled: false },
      { type: 'gap_free', enabled: true },
    ] })) });

    const result = await fixture.getElement().run({ element: 'sheet:main' });

    expect(result.output).toMatchObject({ effects: { automaticEmojis: true, emojiPlacement: 'word', lowercase: true, removePunctuation: false } });
    expect((result.output as { effects: object }).effects).not.toHaveProperty('gapFree');
  });

  it('reads a sound clip with where it starts and how long its file plays', async () => {
    const result = await new ReadOperationsFixture().getElement().run({ element: 'sound:c1' });

    expect(result.output).toMatchObject({
      ref: 'sound:c1',
      kind: 'sound',
      sound: 'whoosh-soft',
      start: { sec: 2, on: 'word:w3 start' },
      fileSec: 0.59,
      volume: 0.8,
    });
  });

  it('reads a sound asked for by its ref, on an emoji the captions do not show now, as such', async () => {
    const fixture = new ReadOperationsFixture();
    const onEmoji = AudioMix.fromSnapshot({ clips: [{
      id: 'c2',
      role: 'effect',
      source: { kind: 'builtin', soundId: 'pop-mouth' },
      start: { anchor: { kind: 'emoji', decorationId: 'w2:d' }, offsetSec: 0 },
    }] }).clip('c2')!;
    fixture.store.patch({ audio: fixture.store.snapshot().audio.withClipAdded(onEmoji) });

    const result = await fixture.getElement().run({ element: 'sound:c2' });

    expect((result.output as { start: unknown }).start).toEqual({ sec: 0.5, on: 'decoration:w2:d', emoji: '🔥 on word:w2', silentUntil: 'its emoji shows' });
  });

  it.each([
    ['text that is no ref', 'nothing'],
    ['a word that is not there', 'word:gone'],
    ['a layer that is not there', 'layer:gone'],
    ['a sheet that is not there', 'sheet:gone'],
    ['a clip that is not there', 'sound:gone'],
  ])('refuses %s, changing nothing', async (_case, element) => {
    const fixture = new ReadOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await fixture.getElement().run({ element });

    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatchObject({ severity: 'error', ref: element });
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('changes nothing in the project when it reads', async () => {
    const fixture = new ReadOperationsFixture();
    const before = fixture.store.snapshot();

    await fixture.getElement().run({ element: 'layer:card' });

    expect(fixture.store.snapshot()).toBe(before);
  });
});
