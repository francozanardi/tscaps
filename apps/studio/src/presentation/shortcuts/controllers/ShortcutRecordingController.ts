import type { AssignShortcutChordAction } from '@core/shortcuts/actions/AssignShortcutChordAction';
import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCommand } from '@core/shortcuts/domain/ShortcutCommand';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutConflictFinder } from '@core/shortcuts/services/ShortcutConflictFinder';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';
import type { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';

/** Nothing is being recorded. */
interface IdleRecording {
  readonly kind: 'idle';
}

/** Waiting for the user to press the chord a command should answer to. */
interface ListeningRecording {
  readonly kind: 'listening';
  readonly commandId: ShortcutCommandId;
  /** The chord the new one takes the place of; `null` adds one. */
  readonly replacing: KeyChord | null;
  /** The last chord pressed that cannot be a shortcut at all, kept to say why. */
  readonly refusedChord: KeyChord | null;
}

/** A chord was pressed that other commands answer to; waiting for the user to say whether to take it. */
interface ConfirmingRecording {
  readonly kind: 'confirming';
  readonly commandId: ShortcutCommandId;
  readonly replacing: KeyChord | null;
  readonly chord: KeyChord;
  readonly conflicts: readonly ShortcutCommand[];
}

export type ShortcutRecording = IdleRecording | ListeningRecording | ConfirmingRecording;

const IDLE: IdleRecording = { kind: 'idle' };

/**
 * Records a new chord for one command at a time.
 *
 * `startRecording` listens for a command; each keydown is then handed to
 * `capture`. A lone modifier is waited past, Escape gives up, and a
 * chord the browser keeps for itself is refused while listening goes
 * on. A chord nobody else answers to is bound at once; one that other
 * live commands answer to waits for `confirm`, which takes it from them,
 * or `cancel`. Pressing a chord the command already has changes nothing.
 *
 * Observable: a `'change'` event fires on every transition.
 */
export class ShortcutRecordingController extends EventTarget {

  private _recording: ShortcutRecording = IDLE;

  constructor(
    private readonly keymapStore: KeymapStore,
    private readonly conflictFinder: ShortcutConflictFinder,
    private readonly assign: AssignShortcutChordAction,
    private readonly chordReader: KeyChordReader,
  ) {
    super();
  }

  get recording(): ShortcutRecording {
    return this._recording;
  }

  startRecording(commandId: ShortcutCommandId, replacing: KeyChord | null): void {
    this.transition({ kind: 'listening', commandId, replacing, refusedChord: null });
  }

  /**
   * Hands a keydown to the recording. Answers whether it was taken, in
   * which case nothing else should act on it.
   */
  capture(event: KeyboardEvent): boolean {
    const recording = this._recording;
    if (recording.kind === 'idle') return false;
    const chord = this.chordReader.read(event);
    if (!chord) return true;
    if (this.isBareEscape(chord)) {
      this.cancel();
      return true;
    }
    if (recording.kind === 'listening') this.record(recording, chord);
    return true;
  }

  /** Binds the chord waiting for confirmation, taking it from the commands it collides with. */
  confirm(): void {
    const recording = this._recording;
    if (recording.kind !== 'confirming') return;
    this.bind(recording.commandId, recording.chord, recording.replacing);
  }

  cancel(): void {
    this.transition(IDLE);
  }

  private record(recording: ListeningRecording, chord: KeyChord): void {
    if (chord.isReservedByBrowser()) {
      this.transition({ ...recording, refusedChord: chord });
      return;
    }
    const keymap = this.keymapStore.keymap;
    if (keymap.chordsFor(recording.commandId).some((owned) => owned.equals(chord))) {
      this.transition(IDLE);
      return;
    }
    const conflicts = this.conflictFinder.conflictsOf(keymap, recording.commandId, chord);
    if (conflicts.length === 0) {
      this.bind(recording.commandId, chord, recording.replacing);
      return;
    }
    this.transition({
      kind: 'confirming',
      commandId: recording.commandId,
      replacing: recording.replacing,
      chord,
      conflicts,
    });
  }

  private bind(commandId: ShortcutCommandId, chord: KeyChord, replacing: KeyChord | null): void {
    this.assign.execute({ commandId, chord, replacing });
    this.transition(IDLE);
  }

  private isBareEscape(chord: KeyChord): boolean {
    return chord.key === 'escape' && !chord.primary && !chord.alt && !chord.shift;
  }

  private transition(next: ShortcutRecording): void {
    this._recording = next;
    this.dispatchEvent(new Event('change'));
  }
}
