import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import type { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';

/**
 * Carries out a command. Answers `false` when there was nothing to act
 * on, which leaves the keystroke to whatever else would have had it.
 */
export type ShortcutHandler = () => boolean | void;

const NON_TEXT_INPUT_TYPES = new Set([
  'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'color',
]);

const ACTIVATABLE_ROLES = new Set([
  'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
  'checkbox', 'radio', 'switch', 'tab',
]);

/**
 * The one keyboard listener behind every shortcut. It reads the chord a
 * keydown presses, looks it up in the keymap in force, and runs the
 * handler bound to the command it names.
 *
 * Commands are declared in the catalog and handled by whoever is on
 * screen to carry them out: `bind` hands over a handler for as long as
 * its surface is mounted. A command with no handler bound does nothing,
 * which is how a mode's shortcuts stay quiet while another mode is open.
 * When two handlers are bound to the same command, the latest one wins
 * until it is unbound.
 *
 * A keystroke is left alone when something before it already claimed
 * it (`defaultPrevented`), while an input method is composing text,
 * when it would type into a text field (see `KeyChord.worksWhileTyping`
 * and `ShortcutCommand.whileTyping`), and when it is Space or Enter on a
 * focused button, which belongs to the button. A keystroke a handler
 * acts on has its browser default suppressed.
 */
export class ShortcutDispatcher {

  private readonly handlersByCommandId = new Map<ShortcutCommandId, ShortcutHandler[]>();

  constructor(
    private readonly keymapStore: KeymapStore,
    private readonly catalog: ShortcutCatalog,
    private readonly chordReader: KeyChordReader,
  ) {}

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  /** Makes `handler` carry out the command until the returned function is called. */
  bind(commandId: ShortcutCommandId, handler: ShortcutHandler): () => void {
    const handlers = this.handlersByCommandId.get(commandId) ?? [];
    this.handlersByCommandId.set(commandId, [...handlers, handler]);
    return () => this.unbind(commandId, handler);
  }

  private unbind(commandId: ShortcutCommandId, handler: ShortcutHandler): void {
    const remaining = (this.handlersByCommandId.get(commandId) ?? []).filter((bound) => bound !== handler);
    if (remaining.length === 0) this.handlersByCommandId.delete(commandId);
    else this.handlersByCommandId.set(commandId, remaining);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return;
    const chord = this.chordReader.read(event);
    if (!chord) return;
    if (this.activatesFocusedControl(event.target, chord)) return;
    const typing = this.isTextEntry(event.target);
    for (const commandId of this.keymapStore.keymap.commandsBoundTo(chord)) {
      if (this.tryCommand(commandId, chord, typing, event)) return;
    }
  };

  /** Runs the command if it is live for this keystroke; answers whether the keystroke was taken. */
  private tryCommand(commandId: ShortcutCommandId, chord: KeyChord, typing: boolean, event: KeyboardEvent): boolean {
    const handlers = this.handlersByCommandId.get(commandId);
    const handler = handlers?.[handlers.length - 1];
    if (!handler) return false;
    const command = this.catalog.get(commandId);
    if (typing && !(command.whileTyping && chord.worksWhileTyping())) return false;
    if (event.repeat && !command.repeats) {
      event.preventDefault();
      return true;
    }
    if (handler() === false) return false;
    event.preventDefault();
    return true;
  }

  private isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type.toLowerCase());
    return false;
  }

  private activatesFocusedControl(target: EventTarget | null, chord: KeyChord): boolean {
    if (chord.primary || chord.alt || chord.shift) return false;
    if (chord.key !== 'space' && chord.key !== 'enter') return false;
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return true;
    if (target instanceof HTMLSelectElement || target.tagName === 'SUMMARY') return true;
    if (target instanceof HTMLInputElement) return NON_TEXT_INPUT_TYPES.has(target.type.toLowerCase());
    const role = target.getAttribute('role');
    return role !== null && ACTIVATABLE_ROLES.has(role);
  }
}
