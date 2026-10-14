import { describe, expect, it } from 'vitest';
import { KeyChord } from '@core/shortcuts/domain/KeyChord';
import { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';

/**
 * A keydown as a listener receives it. Untyped on purpose: one of these
 * tests sends a `key` the DOM type forbids and a browser sends anyway.
 */
function keydown(init: Record<string, unknown>): KeyboardEvent {
  return {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as unknown as KeyboardEvent;
}

const reader = new KeyChordReader();

describe('reading a keydown as a chord', () => {
  it('reads Ctrl and Cmd as the same primary modifier', () => {
    expect(reader.read(keydown({ key: 'z', ctrlKey: true }))).toEqual(new KeyChord('z', true));
    expect(reader.read(keydown({ key: 'z', metaKey: true }))).toEqual(new KeyChord('z', true));
  });

  it('reads the letter as typed, so the key labelled Z is Z on any layout', () => {
    expect(reader.read(keydown({ key: 'z', code: 'KeyW', ctrlKey: true }))).toEqual(new KeyChord('z', true));
  });

  it('keeps Shift on a letter', () => {
    expect(reader.read(keydown({ key: 'Z', shiftKey: true, ctrlKey: true }))).toEqual(new KeyChord('z', true, true));
  });

  it('drops Shift from a symbol that needed it, whatever the layout puts it under', () => {
    expect(reader.read(keydown({ key: '?', code: 'Slash', shiftKey: true }))).toEqual(new KeyChord('?'));
    expect(reader.read(keydown({ key: '?', code: 'Minus', shiftKey: true }))).toEqual(new KeyChord('?'));
  });

  // On a Mac, Alt turns the letter into another character: Alt+K types `˚`.
  it('reads the physical key when Alt changed the character', () => {
    expect(reader.read(keydown({ key: '˚', code: 'KeyK', altKey: true }))).toEqual(new KeyChord('k', false, false, true));
  });

  it('reads named keys by name', () => {
    expect(reader.read(keydown({ key: ' ', code: 'Space' }))).toEqual(new KeyChord('space'));
    expect(reader.read(keydown({ key: 'ArrowUp', code: 'ArrowUp', altKey: true }))).toEqual(new KeyChord('arrowup', false, false, true));
    expect(reader.read(keydown({ key: '+', code: 'Equal', shiftKey: true, ctrlKey: true }))).toEqual(new KeyChord('plus', true));
  });

  it('reads a dead key by the key it sits on', () => {
    expect(reader.read(keydown({ key: 'Dead', code: 'KeyE', altKey: true }))).toEqual(new KeyChord('e', false, false, true));
  });

  it('is no chord while only a modifier is down', () => {
    expect(reader.read(keydown({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }))).toBeNull();
    expect(reader.read(keydown({ key: 'Meta', code: 'MetaLeft', metaKey: true }))).toBeNull();
  });

  // Chromium's autofill dropdown sends keydowns with no `key`; reading
  // one unguarded threw out of the window listener and killed the
  // keystroke for whatever had focus.
  it('is no chord when the event carries no key', () => {
    expect(reader.read(keydown({ key: undefined }))).toBeNull();
  });
});

describe('a chord as text', () => {
  it('reads back what it wrote', () => {
    const chords = [new KeyChord('z', true, true, true), new KeyChord('plus'), new KeyChord('arrowleft', false, true)];

    for (const chord of chords) expect(KeyChord.parse(chord.serialize())).toEqual(chord);
  });

  it('refuses anything that is not a chord', () => {
    expect(KeyChord.parse('')).toBeNull();
    expect(KeyChord.parse('mod+')).toBeNull();
    expect(KeyChord.parse('hyper+z')).toBeNull();
    expect(KeyChord.parse('mod+mod+z')).toBeNull();
  });
});
