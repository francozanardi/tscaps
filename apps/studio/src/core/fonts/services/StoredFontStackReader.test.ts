import { describe, expect, it } from 'vitest';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import type { ControlField } from '@core/templates/domain/definition/ControlField';

const library = new FontStackLibrary();
const reader = new StoredFontStackReader(library);

/**
 * A control id is the template author's to choose — `tag-font-family`
 * in one template, `pepe` in the next — so which controls hold a font
 * is asked of their declared type and never of their name. A rule keyed
 * on the name would work for the templates that happen to name theirs a
 * certain way and silently skip the rest.
 */

const field = (id: string, type: ControlField['type']): ControlField =>
  ({ id, type, label: id, default: '' });

describe('a control declared as a font', () => {
  const fields = [field('pepe', 'font')];

  it('opens a family name into the stack that family leads, whatever the control is called', () => {
    expect(reader.readStyleValues(fields, { pepe: 'Kalam' }).pepe)
      .toEqual(library.stackFor('kalam').toSnapshot());
  });

  it('leaves a value that is already a stack exactly as it was', () => {
    const stored = library.stackFor('anton').toSnapshot();
    expect(reader.readStyleValues(fields, { pepe: stored }).pepe).toEqual(stored);
  });

  // Left out rather than carried through: the control falls back to
  // what its template ships, which renders.
  it('drops a value that is neither a name nor a stack', () => {
    expect(reader.readStyleValues(fields, { pepe: 7 })).not.toHaveProperty('pepe');
  });

  it('says nothing about a control the payload never held', () => {
    expect(reader.readStyleValues(fields, {})).not.toHaveProperty('pepe');
  });
});

describe('a control declared as anything else', () => {
  it('keeps its value even when it reads like a family name', () => {
    const fields = [field('label-text', 'text'), field('primary-color', 'color')];
    const stored = { 'label-text': 'Anton', 'primary-color': '#ffffff' };
    expect(reader.readStyleValues(fields, stored)).toEqual(stored);
  });
});

describe('typography written down before a font was a stack', () => {
  it('holds the stack its family led', () => {
    const read = reader.readTypography({ fontFamily: 'Anton', fontSize: 4 });
    expect(read.fontStack).toEqual(library.stackFor('anton').toSnapshot());
    expect(read.fontFamily).toBeUndefined();
    expect(read.fontSize).toBe(4);
  });

  it('leaves typography that already holds a stack alone', () => {
    const already = { fontStack: library.stackFor('anton').toSnapshot(), fontSize: 4 };
    expect(reader.readTypography(already)).toEqual(already);
  });
});
