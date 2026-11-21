import { describe, expect, it } from 'vitest';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetCategory } from '@core/graphics/domain/GraphicPresetCategory';
import { GraphicPresetGalleryLayout } from '@presentation/graphics/services/GraphicPresetGalleryLayout';

function presetOf(id: string, category: GraphicPresetCategory | null, description = ''): GraphicPreset {
  return {
    id,
    name: id,
    description,
    category,
    graphic: { document: { html: id, css: '', js: '' }, fields: [], params: {}, aspectRatio: 1, moments: [], presetId: id, hidesCaptions: false },
    box: { kind: 'full' },
    motion: { entrance: null, exit: null },
    sounds: [],
    style: null,
  };
}

describe('GraphicPresetGalleryLayout', () => {
  const layout = new GraphicPresetGalleryLayout();
  const presets = [
    presetOf('Mine', null),
    presetOf('Progress', 'info', 'How far the video is'),
    presetOf('Follow', 'social', 'A profile card'),
    presetOf('Lower third', 'speakers', 'Who is speaking'),
    presetOf('Comment', 'social', 'Asks for a keyword to follow up'),
    presetOf('Headline', 'hooks', 'A bold headline'),
    presetOf('Text box', 'text', 'Lines on one joined box'),
  ];

  it('lists what the user saved first, then each family, the hooks leading only on the first shot', () => {
    expect(layout.build(presets, true).map(({ label, presets: listed }) => [label, listed.map(({ id }) => id)])).toEqual([
      ['Saved', ['Mine']],
      ['Hooks', ['Headline']],
      ['Text', ['Text box']],
      ['Speakers', ['Lower third']],
      ['Social', ['Follow', 'Comment']],
      ['Info', ['Progress']],
    ]);
    expect(layout.build(presets, false).map(({ id }) => id)).toEqual(['saved', 'text', 'speakers', 'social', 'info', 'hooks']);
  });

  it('leaves out a family with nothing in it', () => {
    expect(layout.build(presets.slice(1, 4), true).map(({ id }) => id)).toEqual(['speakers', 'social', 'info']);
  });

  it('finds by name first and then by what a preset is for, ignoring case, and nothing for an empty search', () => {
    expect(layout.search(presets, ' FOLLOW ').map(({ id }) => id)).toEqual(['Follow', 'Comment']);
    expect(layout.search(presets, 'speaking').map(({ id }) => id)).toEqual(['Lower third']);
    expect(layout.search(presets, '  ')).toEqual([]);
  });
});
