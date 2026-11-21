import { describe, expect, it } from 'vitest';
import { ReadOperationsFixture } from '@core/editor-operations/testing/ReadOperationsFixture';
import { RECOMMENDED_TEMPLATES } from '@core/editor-operations/services/RecommendedTemplates';

/**
 * The catalogs a caller picks ids from: each answers rows whose ids the
 * editing operations take, read off what the editor ships and what the
 * project holds.
 */
describe('list_catalog', () => {
  async function listed(catalog: string): Promise<Record<string, unknown>> {
    const result = await new ReadOperationsFixture().listCatalog().run({ catalog });
    expect(result.ok).toBe(true);
    return result.output as Record<string, unknown>;
  }

  it('lists the templates with their author\'s description, presets and font', async () => {
    expect((await listed('templates'))['others']).toEqual([{ id: 'ada', family: 'classic' }]);
    expect((await listed('all_templates'))['others']).toEqual([{
      id: 'ada',
      family: 'classic',
      description: 'Bold words in a light pill.',
      presets: ['Light', 'Dark'],
      font: expect.any(String),
    }]);
  });

  it('lists the recommended templates apart, in their order, each with when it suits', async () => {
    const fixture = new ReadOperationsFixture();
    fixture.store.patch({ availableTemplates: [fixture.templateNamed('ada'), fixture.templateNamed('yuki'), fixture.templateNamed('mira')] });

    const result = await fixture.listCatalog().run({ catalog: 'templates' });

    const output = result.output as { recommended: Array<{ id: string; when: string }>; others: Array<{ id: string }> };
    expect(output.recommended.map((row) => row.id)).toEqual(['mira', 'yuki']);
    expect(output.recommended.map((row) => row.when)).toEqual(['mira', 'yuki'].map((id) => RECOMMENDED_TEMPLATES.find((pick) => pick.id === id)!.when));
    expect(output.others.map((row) => row.id)).toEqual(['ada']);
  });

  it('says which scopes each caption kind offers and which kind each one moves', async () => {
    const output = await listed('caption_animations');

    expect(output['scopes']).toEqual({
      segment: { self: 'segment', exit: 'segment', words: 'word', 'words-exit': 'word', emojis: 'decoration', 'emojis-exit': 'decoration' },
      line: { self: 'line', exit: 'line', words: 'word', 'words-exit': 'word' },
      word: { self: 'word', exit: 'word' },
      decoration: { self: 'decoration', exit: 'decoration' },
      sheet: { segments: 'segment', 'segments-exit': 'segment', words: 'word', 'words-exit': 'word', emojis: 'decoration', 'emojis-exit': 'decoration' },
    });
    expect(output['presets']).toContainEqual({
      id: 'pop-in',
      name: 'Pop in',
      moves: ['segment', 'line', 'word', 'decoration'],
      params: { overshoot: expect.stringContaining('0 to 0.5'), duration: expect.stringContaining('0.05 to 1.5 s') },
    });
  });

  it('lists a layer\'s entrances and exits apart, and the camera moves', async () => {
    const motions = await listed('layer_motions') as { entrance: Array<{ id: string }>; exit: Array<{ id: string }> };
    const cameras = await listed('camera_moves') as { moves: Array<{ id: string; name: string }> };

    expect(motions.entrance.map((row) => row.id)).toContain('layer-fade-entrance');
    expect(motions.entrance.map((row) => row.id)).not.toContain('layer-fade-exit');
    expect(motions.exit.map((row) => row.id)).toContain('layer-fade-exit');
    expect(cameras.moves).toContainEqual(expect.objectContaining({ id: 'layer-punch-in-camera', name: 'Punch in' }));
  });

  it('lists the media bin, marking the files the project uses', async () => {
    expect((await listed('media'))['media']).toEqual([
      { id: 'clip', name: 'broll.mp4', type: 'video', sec: 5, width: 1920, height: 1080, used: true },
    ]);
  });

  it('lists the shot transitions with the durations they take', async () => {
    const output = await listed('transitions') as { kinds: Array<{ kind: string }>; durationSec: unknown };

    expect(output.kinds.map((row) => row.kind)).toContain('flash');
    expect(output.durationSec).toEqual({ min: 0.2, max: 1.5 });
  });

  it('lists the bundled sounds with what each suits and the volume that sits it under a voice, the looks, the word tags and the graphic presets by id', async () => {
    expect((await listed('sounds'))['sounds']).toContainEqual({ id: 'whoosh-soft', category: 'whoosh', sec: 0.59, sounds: expect.stringMatching(/^A soft, airy whoosh/) });
    expect((await listed('looks'))['looks']).toContainEqual({ id: 'mono', name: 'Black & white', values: { saturation: -1, contrast: 0.15 } });
    expect((await listed('word_tags'))['tags']).toContainEqual(expect.objectContaining({ tag: 'emphasis', label: 'Emphasis' }));
    expect((await listed('graphic_presets'))['presets']).toContainEqual(expect.objectContaining({
      id: 'lower-third',
      family: 'speakers',
      fields: { title: 'text', subtitle: 'text', accent: 'color' },
    }));
  });

  it('reads the graphic presets named in full: each field\'s label and default, the box and the aspect ratio', async () => {
    const result = await new ReadOperationsFixture().listCatalog().run({ catalog: 'graphic_presets', ids: ['lower-third'] });
    const presets = (result.output as { presets: Array<Record<string, unknown>> }).presets;

    expect(presets).toHaveLength(1);
    expect(presets[0]).toEqual(expect.objectContaining({
      id: 'lower-third',
      box: expect.objectContaining({ width: expect.any(Number) }),
      fields: expect.arrayContaining([{ id: 'title', label: 'Title', kind: 'text', default: 'Your name' }]),
    }));
  });

  it('refuses to read in full a preset that does not exist, naming those that do', async () => {
    const result = await new ReadOperationsFixture().listCatalog().run({ catalog: 'graphic_presets', ids: ['nope'] });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('lower-third');
  });

  it('reads sounds in full, with the volume that sits each under a voice, and lists only one category when asked', async () => {
    const catalog = new ReadOperationsFixture().listCatalog();
    const full = await catalog.run({ catalog: 'sounds', ids: ['whoosh-soft'] });
    const whooshes = await catalog.run({ catalog: 'sounds', category: 'whoosh' });
    const unknown = await catalog.run({ catalog: 'sounds', category: 'kazoo' });

    expect((full.output as { sounds: unknown[] }).sounds).toEqual([expect.objectContaining({ id: 'whoosh-soft', underVoice: 0.061 })]);
    expect((whooshes.output as { sounds: Array<{ category: string }> }).sounds.every((sound) => sound.category === 'whoosh')).toBe(true);
    expect(unknown.ok).toBe(false);
    expect(unknown.problems[0]?.message).toContain('whoosh');
  });

  it('refuses a catalog it does not have', async () => {
    const result = await new ReadOperationsFixture().listCatalog().run({ catalog: 'fonts' });

    expect(result.ok).toBe(false);
  });
});
