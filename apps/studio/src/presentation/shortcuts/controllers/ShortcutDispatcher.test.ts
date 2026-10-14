import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyChord } from '@core/shortcuts/domain/KeyChord';
import { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import { SHORTCUT_COMMANDS } from '@core/shortcuts/domain/ShortcutCommands';
import { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import { KeymapResolver } from '@core/shortcuts/services/KeymapResolver';
import { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';
import { ShortcutDispatcher } from '@presentation/shortcuts/controllers/ShortcutDispatcher';

// The suite runs in Node, which has no DOM. These stand in for the few
// element types the dispatcher tells apart, with the members it reads.
class FakeHTMLElement {
  isContentEditable = false;
  constructor(readonly tagName: string = 'DIV', private readonly role: string | null = null) {}
  getAttribute(name: string): string | null {
    return name === 'role' ? this.role : null;
  }
}
class FakeHTMLTextAreaElement extends FakeHTMLElement {}
class FakeHTMLInputElement extends FakeHTMLElement {
  constructor(readonly type: string) {
    super('INPUT');
  }
}
class FakeHTMLButtonElement extends FakeHTMLElement {}
class FakeHTMLAnchorElement extends FakeHTMLElement {}
class FakeHTMLSelectElement extends FakeHTMLElement {}

class FakeKeyboardEvent extends Event {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly isComposing = false;

  constructor(init: { key: string; code?: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean }) {
    super('keydown', { cancelable: true });
    this.key = init.key;
    this.code = init.code ?? '';
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = false;
    this.shiftKey = init.shiftKey ?? false;
    this.altKey = init.altKey ?? false;
    this.repeat = init.repeat ?? false;
  }
}

let page: EventTarget;

beforeEach(() => {
  page = new EventTarget();
  vi.stubGlobal('window', page);
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
  vi.stubGlobal('HTMLTextAreaElement', FakeHTMLTextAreaElement);
  vi.stubGlobal('HTMLInputElement', FakeHTMLInputElement);
  vi.stubGlobal('HTMLButtonElement', FakeHTMLButtonElement);
  vi.stubGlobal('HTMLAnchorElement', FakeHTMLAnchorElement);
  vi.stubGlobal('HTMLSelectElement', FakeHTMLSelectElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function startDispatcher(overrides: KeymapOverrides = KeymapOverrides.empty()) {
  const catalog = new ShortcutCatalog(SHORTCUT_COMMANDS);
  const store = new KeymapStore();
  const resolver = new KeymapResolver(catalog);
  store.set(resolver.resolve(overrides), overrides);
  const dispatcher = new ShortcutDispatcher(store, catalog, new KeyChordReader());
  dispatcher.start();
  return { dispatcher, store, resolver };
}

/** Presses a key with `target` focused; answers whether the browser default was suppressed. */
function press(init: ConstructorParameters<typeof FakeKeyboardEvent>[0], target: FakeHTMLElement = new FakeHTMLElement()): boolean {
  const event = new FakeKeyboardEvent(init);
  Object.defineProperty(event, 'target', { value: target });
  page.dispatchEvent(event);
  return event.defaultPrevented;
}

const SPACE = { key: ' ', code: 'Space' };
const ALT_K = { key: '˚', code: 'KeyK', altKey: true };
const ARROW_RIGHT = { key: 'ArrowRight', code: 'ArrowRight' };

describe('dispatching a shortcut', () => {
  it('carries out the command the chord is bound to, in place of the browser default', () => {
    const { dispatcher } = startDispatcher();
    const toggle = vi.fn();
    dispatcher.bind('playback.toggle', toggle);

    const suppressed = press(SPACE);

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(suppressed).toBe(true);
  });

  it('leaves the keystroke alone while nothing is there to carry the command out', () => {
    const { dispatcher } = startDispatcher();
    const unbind = dispatcher.bind('playback.toggle', vi.fn());
    unbind();

    expect(press(SPACE)).toBe(false);
  });

  it('answers to the newest handler, and to the one before it once that one is gone', () => {
    const { dispatcher } = startDispatcher();
    const outer = vi.fn();
    const inner = vi.fn();
    dispatcher.bind('editor.search', outer);
    const unbindInner = dispatcher.bind('editor.search', inner);

    press({ key: 'f', code: 'KeyF', ctrlKey: true });
    unbindInner();
    press({ key: 'f', code: 'KeyF', ctrlKey: true });

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('leaves the browser default in place when the handler had nothing to act on', () => {
    const { dispatcher } = startDispatcher();
    dispatcher.bind('timeline.release', () => false);

    expect(press({ key: 'Escape', code: 'Escape' })).toBe(false);
  });

  it('answers to a chord the user gave the command as soon as it is given', () => {
    const { dispatcher, store, resolver } = startDispatcher();
    const pause = vi.fn();
    dispatcher.bind('playback.pause', pause);

    const overrides = KeymapOverrides.empty().with('playback.pause', [new KeyChord('j', true)]);
    store.set(resolver.resolve(overrides), overrides);
    press({ key: 'j', code: 'KeyJ', ctrlKey: true });

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('ignores a keystroke something before it already claimed', () => {
    page.addEventListener('keydown', (event) => event.preventDefault());
    const { dispatcher } = startDispatcher();
    const toggle = vi.fn();
    dispatcher.bind('playback.toggle', toggle);

    press(SPACE);

    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('dispatching while the user types', () => {
  it('lets a bare key type into the field', () => {
    const { dispatcher } = startDispatcher();
    const toggle = vi.fn();
    dispatcher.bind('playback.toggle', toggle);

    const suppressed = press(SPACE, new FakeHTMLTextAreaElement());

    expect(toggle).not.toHaveBeenCalled();
    expect(suppressed).toBe(false);
  });

  it('carries out a command that allows it, on a chord with a modifier', () => {
    const { dispatcher } = startDispatcher();
    const toggle = vi.fn();
    dispatcher.bind('playback.toggle', toggle);

    press(ALT_K, new FakeHTMLInputElement('text'));

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('leaves a modified chord to the field when the command does not allow typing', () => {
    const { dispatcher } = startDispatcher();
    const previousWord = vi.fn();
    dispatcher.bind('playback.previousWord', previousWord);

    press({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true }, new FakeHTMLTextAreaElement());

    expect(previousWord).not.toHaveBeenCalled();
  });

  it('treats a checkbox as no text field', () => {
    const { dispatcher } = startDispatcher();
    const nextFrame = vi.fn();
    dispatcher.bind('playback.nextFrame', nextFrame);

    press(ARROW_RIGHT, new FakeHTMLInputElement('checkbox'));

    expect(nextFrame).toHaveBeenCalledTimes(1);
  });
});

describe('dispatching on focused controls and held keys', () => {
  it('leaves Space to a focused button', () => {
    const { dispatcher } = startDispatcher();
    const toggle = vi.fn();
    dispatcher.bind('playback.toggle', toggle);

    press(SPACE, new FakeHTMLButtonElement('BUTTON'));
    press(SPACE, new FakeHTMLElement('DIV', 'menuitem'));

    expect(toggle).not.toHaveBeenCalled();
  });

  it('fires a stepping command again on every key repeat', () => {
    const { dispatcher } = startDispatcher();
    const nextFrame = vi.fn();
    dispatcher.bind('playback.nextFrame', nextFrame);

    press(ARROW_RIGHT);
    press({ ...ARROW_RIGHT, repeat: true });

    expect(nextFrame).toHaveBeenCalledTimes(2);
  });

  it('fires a one-shot command once however long the key is held, keeping the default suppressed', () => {
    const { dispatcher } = startDispatcher();
    const toggle = vi.fn();
    dispatcher.bind('playback.toggle', toggle);

    press(SPACE);
    const suppressed = press({ ...SPACE, repeat: true });

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(suppressed).toBe(true);
  });
});
