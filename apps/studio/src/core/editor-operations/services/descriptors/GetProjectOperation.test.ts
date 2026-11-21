import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ReadOperationsFixture } from '@core/editor-operations/testing/ReadOperationsFixture';

/**
 * The overview a caller reads before editing: everything it answers is
 * read off the project as it is, in seconds of the source video, and
 * reading it changes nothing.
 */
describe('get_project', () => {
  it('answers the video as it is exported, in source seconds', async () => {
    const result = await new ReadOperationsFixture().getProject().run({});

    expect(result.ok).toBe(true);
    expect((result.output as { video: unknown }).video).toEqual({
      durationSec: 12,
      durationAfterCutsSec: 11,
      width: 1080,
      height: 1920,
      format: '9:16',
      fit: 'fill',
      source: { width: 1920, height: 1080 },
      language: 'en',
      playheadSec: 3,
    });
  });

  it('lists each sheet with its template and how many segments it styles, the shown one marked', async () => {
    const result = await new ReadOperationsFixture().getProject().run({});

    expect((result.output as { sheets: unknown }).sheets).toEqual([
      { ref: 'sheet:main', name: 'Main', template: { id: 'ada', name: 'ada' }, active: true, segments: 2 },
      { ref: 'sheet:second', name: 'Second', template: { id: 'ada', name: 'ada' }, segments: 1 },
    ]);
  });

  it('lists the shots in order with their transition, camera move and layers', async () => {
    const result = await new ReadOperationsFixture().getProject().run({});

    expect((result.output as { shots: unknown }).shots).toEqual([
      { ref: 'shot:a', startSec: 0, endSec: 6 },
      {
        ref: 'shot:b',
        startSec: 6,
        endSec: 12,
        transition: { kind: 'flash', durationSec: 0.4 },
        camera: 'layer-punch-in-camera',
        layers: [
          { ref: 'layer:broll', type: 'video', name: 'broll.mp4' },
          { ref: 'layer:card', type: 'graphic', name: 'Speaker card: "Ada Lovelace"' },
        ],
      },
    ]);
  });

  it('says how far a layer shows, and on a later shot which layers still show on it', async () => {
    const fixture = new ReadOperationsFixture();
    fixture.store.patch({ shots: fixture.store.snapshot().shots.splitAt(9, 'c').withLayerThrough('broll', 'b') });

    const result = await fixture.getProject().run({});

    const shots = (result.output as { shots: Array<{ ref: string; layers?: Array<{ ref: string; through?: string }>; continuing?: string[] }> }).shots;
    expect(shots.map((shot) => [shot.ref, shot.layers?.map((layer) => [layer.ref, layer.through]), shot.continuing])).toEqual([
      ['shot:a', undefined, undefined],
      ['shot:b', [['layer:broll', undefined], ['layer:card', 'shot:c']], undefined],
      ['shot:c', undefined, ['layer:card']],
    ]);
  });

  it('says how far a shot\'s camera runs, and on a later shot whose camera runs over it', async () => {
    const fixture = new ReadOperationsFixture();
    const split = fixture.store.snapshot().shots.splitAt(9, 'c');
    // The split gives the new shot the punch-in as its own; taken off it, the first half's is told to run over it.
    fixture.store.patch({ shots: split.withLayerStyles(split.layerStyles.without(['shot-video-c'])).withVideoThrough('b', 'c') });

    const result = await fixture.getProject().run({});

    const shots = (result.output as { shots: Array<{ ref: string; camera?: string; cameraThrough?: string; cameraFrom?: string }> }).shots;
    expect(shots.map((shot) => [shot.ref, shot.camera, shot.cameraThrough, shot.cameraFrom])).toEqual([
      ['shot:a', undefined, undefined, undefined],
      ['shot:b', 'layer-punch-in-camera', 'shot:c', undefined],
      ['shot:c', undefined, undefined, 'shot:b'],
    ]);
  });

  it('answers the cuts, the sound clips where they start, the grade and the styled elements', async () => {
    const result = await new ReadOperationsFixture().getProject().run({});
    const output = result.output as Record<string, unknown>;

    expect(output['cuts']).toEqual([{ startSec: 10, endSec: 11 }]);
    expect(output['sounds']).toEqual([
      { ref: 'sound:c1', role: 'effect', sound: 'whoosh-soft', start: { sec: 2, on: 'word:w3 start' }, volume: 0.8 },
    ]);
    expect(output['colorGrade']).toEqual({ saturation: 0.2 });
    expect(output['styledElements']).toEqual({ word: 1, segment: 1, shot: 1 });
  });

  it('lists a sound on an emoji the layout does not show, saying so, so removing every sound listed removes it too', async () => {
    const fixture = new ReadOperationsFixture();
    const onEmoji = AudioMix.fromSnapshot({ clips: [{
      id: 'c2',
      role: 'effect',
      source: { kind: 'builtin', soundId: 'pop-mouth' },
      start: { anchor: { kind: 'emoji', decorationId: 'w2:d' }, offsetSec: 0 },
    }] }).clip('c2')!;
    fixture.store.patch({ audio: fixture.store.snapshot().audio.withClipAdded(onEmoji) });

    const sounds = ((await fixture.getProject().run({})).output as { sounds: Array<{ ref: string; start: unknown }> }).sounds;

    expect(sounds.map((sound) => sound.ref)).toEqual(['sound:c1', 'sound:c2']);
    expect(sounds[1]!.start).toEqual({ sec: 0.5, on: 'decoration:w2:d', emoji: '🔥 on word:w2', silentUntil: 'its emoji shows' });
  });

  it('lists the music with its level, its loop and how far it is lowered under speech', async () => {
    const fixture = new ReadOperationsFixture();
    const music = AudioMix.fromSnapshot({ clips: [{
      id: 'm',
      role: 'music',
      source: { kind: 'media', mediaId: 'clip' },
      start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
      end: { anchor: { kind: 'video', edge: 'end' }, offsetSec: 0 },
      loop: true,
      volume: 0.4,
      ducking: { enabled: true, depthDb: -18 },
    }] }).clip('m')!;
    fixture.store.patch({ audio: fixture.store.snapshot().audio.withClipAdded(music) });

    const sounds = ((await fixture.getProject().run({})).output as { sounds: Array<{ ref: string }> }).sounds;

    expect(sounds.find((sound) => sound.ref === 'sound:m')).toMatchObject({ role: 'music', volume: 0.4, loop: true, duckingDb: -18 });
  });

  it('says nothing of the voices where the transcription told them apart', async () => {
    const result = await new ReadOperationsFixture().getProject().run({});

    expect(result.output).not.toHaveProperty('speakers');
  });

  it('says that who speaks is not known where the transcription told no voices apart', async () => {
    const fixture = new ReadOperationsFixture();
    const word = new Word({ id: 'w', text: 'Hello.', time: new TimeFragment(0, 1), speakerId: null });
    fixture.store.patch({ document: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ id: 's', lines: [new Line({ words: [word] })] })] })] }) });

    const result = await fixture.getProject().run({});

    expect((result.output as { speakers: unknown }).speakers).toEqual({ known: [], note: expect.stringContaining('do not style or colour captions by speaker') });
  });

  it('changes nothing in the project', async () => {
    const fixture = new ReadOperationsFixture();
    const before = fixture.store.snapshot();

    await fixture.getProject().run({});

    expect(fixture.store.snapshot()).toBe(before);
  });

  it('refuses an input it does not take', async () => {
    const result = await new ReadOperationsFixture().getProject().run({ verbose: true });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.severity).toBe('error');
  });
});
