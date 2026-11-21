import { describe, expect, it } from 'vitest';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateCategory } from '@core/templates/domain/TemplateCategory';
import { TemplateGalleryLayout } from '@presentation/editor/services/TemplateGalleryLayout';

function template(id: string, category: TemplateCategory): Template {
  return { metadata: { id, name: id, category } } as unknown as Template;
}

const BUILTINS = [
  template('levi', 'magazine'),
  template('noor', 'modern'),
  template('zara', 'viral'),
  template('juno', 'viral'),
  template('vera', 'classic'),
];

function input(overrides: Partial<Parameters<TemplateGalleryLayout['build']>[0]> = {}) {
  return {
    builtins: BUILTINS,
    userTemplates: [],
    favoriteIds: new Set<string>(),
    ...overrides,
  };
}

describe('TemplateGalleryLayout', () => {
  const layout = new TemplateGalleryLayout();

  it('lists one section per non-empty family, in the shipped order', () => {
    const sections = layout.build(input());
    expect(sections.map((s) => s.id)).toEqual(['modern', 'magazine', 'viral', 'classic']);
  });

  it('drops a family nothing is filed under', () => {
    const sections = layout.build(input());
    expect(sections.some((s) => s.id === 'lab')).toBe(false);
  });

  it('leads a family with its favorites and keeps the rest in order', () => {
    const sections = layout.build(input({ favoriteIds: new Set(['juno']) }));
    const viral = sections.find((s) => s.id === 'viral');
    expect(viral?.templates.map((t) => t.metadata.id)).toEqual(['juno', 'zara']);
  });

  it('collects favorites into their own section across families', () => {
    const sections = layout.build(input({ favoriteIds: new Set(['juno', 'levi']) }));
    const favorites = sections.find((s) => s.id === 'favorites');
    expect(favorites?.templates.map((t) => t.metadata.id)).toEqual(['levi', 'juno']);
  });

  it('keeps saved templates out of the family sections', () => {
    const saved = [template('mine', 'viral')];
    const sections = layout.build(input({ userTemplates: saved }));
    expect(sections[0]?.id).toBe('saved');
    expect(sections.find((s) => s.id === 'viral')?.templates.map((t) => t.metadata.id))
      .toEqual(['zara', 'juno']);
  });

  it('keeps a favorited template in its own family too, so its preview cannot change', () => {
    const sections = layout.build(input({ favoriteIds: new Set(['levi']) }));
    expect(sections.find((s) => s.id === 'favorites')?.templates.map((t) => t.metadata.id))
      .toEqual(['levi']);
    expect(sections.find((s) => s.id === 'magazine')?.templates.map((t) => t.metadata.id))
      .toEqual(['levi']);
  });

  it('answers an empty query with nothing so the caller keeps browsing', () => {
    expect(layout.search(input(), '   ')).toEqual([]);
  });

  it('matches names case-insensitively across families, saved ones first', () => {
    const saved = [template('Zen', 'viral')];
    const found = layout.search(input({ userTemplates: saved }), 'Z');
    expect(found.map((t) => t.metadata.id)).toEqual(['Zen', 'zara']);
  });
});
