import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCategory } from '@core/shortcuts/domain/ShortcutCategory';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutScope } from '@core/shortcuts/domain/ShortcutScope';

/**
 * Something the user can do from the keyboard, described once so it can
 * be listed, rebound and fired from one place. It says nothing about how
 * the command is carried out — that is whoever handles it at runtime.
 */
export interface ShortcutCommand {
  readonly id: ShortcutCommandId;
  /** Short imperative name, as listed to the user. */
  readonly title: string;
  /** One line on anything about the command the title cannot carry. */
  readonly hint?: string;
  readonly category: ShortcutCategory;
  readonly scope: ShortcutScope;
  /** The chords it answers to until the user says otherwise. May be empty. */
  readonly defaultChords: readonly KeyChord[];
  /**
   * Whether it may fire while focus is in a text field. Even then only a
   * chord that `worksWhileTyping` does: a bare key there is typing.
   */
  readonly whileTyping: boolean;
  /** Whether holding the chord down fires it again with every key repeat. */
  readonly repeats: boolean;
}
