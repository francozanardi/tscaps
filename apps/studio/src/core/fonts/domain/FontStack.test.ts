import { describe, expect, it } from 'vitest';
import { FontStack } from '@core/fonts/domain/FontStack';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';

const library = new FontStackLibrary();

/**
 * A stack is one family per writing system, and the faces are
 * independent of each other. Tying two of them together is the bug this
 * shape exists to make impossible: a reader who picks a Latin face and
 * finds their Arabic one moved has been overruled by machinery they
 * cannot see.
 */

describe('reading a stack for one writing system', () => {
  const anton = library.stackFor('anton');

  it('puts the face that draws that script first', () => {
    expect(anton.ledBy('arabic')[0]).toBe('Lalezar');
    expect(anton.ledBy('latin')[0]).toBe('Anton');
  });

  it('keeps the rest behind it as a net for stray characters', () => {
    expect(anton.ledBy('arabic')).toContain('Anton');
  });

  it('names a face once however many scripts it draws', () => {
    const inter = library.stackFor('inter');
    const led = inter.ledBy('cyrillic');
    expect(led.filter((family) => family === 'Inter Variable')).toHaveLength(1);
  });
});

describe('tuning one face', () => {
  const tuned = library.stackFor('anton').with('latin', 'Lora Variable');

  it('changes that face', () => {
    expect(tuned.familyFor('latin')).toBe('Lora Variable');
  });

  it('leaves every other face where it was', () => {
    const before = library.stackFor('anton');
    for (const script of [
      'arabic', 'hebrew', 'urdu', 'cyrillic', 'greek', 'devanagari',
      'bengali', 'telugu', 'tamil', 'thai',
    ] as const) {
      expect(tuned.familyFor(script)).toBe(before.familyFor(script));
    }
  });

  it('leaves the stack it was asked of alone', () => {
    const before = library.stackFor('anton');
    before.with('latin', 'Lora Variable');
    expect(before.familyFor('latin')).toBe('Anton');
  });

  it('changes unsupported writing systems without moving a managed face', () => {
    const before = library.stackFor('anton');
    const tunedOther = before.with('other', 'serif');
    expect(tunedOther.familyFor('other')).toBe('serif');
    expect(tunedOther.familyFor('latin')).toBe(before.familyFor('latin'));
  });
});

describe('reading a stack back out of storage', () => {
  const complete = library.stackFor('anton').toSnapshot();

  it('gives back what was written', () => {
    expect(FontStack.fromStoredFaces(complete)?.toSnapshot()).toEqual(complete);
  });

  it('defaults the new Other face when an older payload has none', () => {
    const { other: _missingInOlderProjects, ...legacy } = complete;
    expect(FontStack.fromStoredFaces(legacy)?.familyFor('other')).toBe('sans-serif');
  });

  // All or nothing: a stack missing a face would paint that writing
  // system in whatever the device supplies, where no stack at all
  // leaves the element on what it inherits, which renders.
  it('refuses a payload that is missing a face', () => {
    const { greek: _dropped, ...incomplete } = complete;
    expect(FontStack.fromStoredFaces(incomplete)).toBeNull();
  });

  it('refuses a payload whose face is not a name', () => {
    expect(FontStack.fromStoredFaces({ ...complete, greek: 42 })).toBeNull();
    expect(FontStack.fromStoredFaces({ ...complete, greek: '' })).toBeNull();
  });

  it('refuses anything that is not a set of faces', () => {
    for (const value of [null, undefined, 'Anton', 7]) {
      expect(FontStack.fromStoredFaces(value)).toBeNull();
    }
  });
});

/**
 * The editor tells a sheet from its template by stringifying both, so a
 * stack has to serialize its faces rather than the object holding them,
 * and two stacks holding the same faces have to read alike whichever
 * way each was built.
 */
describe('telling two stacks apart through JSON', () => {
  it('reads differently from a stack with another face', () => {
    const anton = library.stackFor('anton');
    expect(JSON.stringify(anton)).not.toBe(JSON.stringify(anton.with('greek', 'Roboto')));
  });

  it('reads the same as a stack holding the same faces', () => {
    const built = library.stackFor('anton');
    const restored = FontStack.fromStoredFaces(built.toSnapshot());
    expect(JSON.stringify(restored)).toBe(JSON.stringify(built));
  });

  it('reads the same however the faces got there', () => {
    const tuned = library.stackFor('anton').with('greek', 'Roboto');
    const restored = FontStack.fromStoredFaces({ ...library.stackFor('anton').toSnapshot(), greek: 'Roboto' });
    expect(JSON.stringify(restored)).toBe(JSON.stringify(tuned));
  });
});

describe('the stack a family leads', () => {
  it('is the catalog one when the catalog knows the family', () => {
    expect(library.stackLedBy('Anton').toSnapshot()).toEqual(library.stackFor('anton').toSnapshot());
  });

  // A font the reader uploaded: its coverage is unknowable, so it keeps
  // the Latin seat and designed faces answer for everything else.
  it('keeps an unknown family in the Latin seat of the default stack', () => {
    const uploaded = library.stackLedBy('Comic Papyrus');
    expect(uploaded.familyFor('latin')).toBe('Comic Papyrus');
    expect(uploaded.familyFor('arabic')).toBe(library.stackFor('inter').familyFor('arabic'));
  });
});
