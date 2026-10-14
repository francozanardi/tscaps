import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AlertTriangle, Plus, RotateCcw, X } from 'lucide-react';
import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCommand } from '@core/shortcuts/domain/ShortcutCommand';
import type {
  ShortcutRecording,
  ShortcutRecordingController,
} from '@presentation/shortcuts/controllers/ShortcutRecordingController';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { useKeyChordLabeler } from '@ui/_shared/hooks/useKeyChordLabeler';
import { KeyChordKeys } from '@ui/shortcuts/components/KeyChordKeys';

interface ShortcutRowProps {
  command: ShortcutCommand;
  chords: readonly KeyChord[];
  /** Whether the user changed this command's chords from its defaults. */
  customized: boolean;
  recording: ShortcutRecording;
  recorder: ShortcutRecordingController;
  onRemove: (chord: KeyChord) => void;
  onReset: () => void;
}

const ROW_CLASS = 'flex flex-col gap-2 py-2 border-b border-edge-faint last:border-b-0';

// The key caps carry the chord's whole look; the chip around them only
// appears on hover or focus, to say it can be clicked.
const CHORD_CLASS =
  'group relative inline-flex items-center rounded-xs border border-transparent ' +
  'transition-colors duration-quick ease-standard hover:border-edge-medium focus-within:border-accent';

const CHORD_BUTTON_CLASS =
  'inline-flex items-center h-7 px-1 bg-transparent border-none cursor-pointer rounded-xs focus-visible:outline-none';

// Floats on the chip's corner so it takes no room while hidden.
const CHORD_REMOVE_CLASS =
  'absolute -top-2 -right-2 inline-flex items-center justify-center w-4 h-4 rounded-pill cursor-pointer ' +
  'bg-surface-3 border border-edge-medium text-fg-muted ' +
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ' +
  'hover:text-fg-primary focus-visible:outline-none focus-visible:opacity-100 focus-visible:border-accent';

const ICON_BUTTON_CLASS =
  'inline-flex items-center justify-center w-7 h-7 bg-transparent border border-transparent rounded-xs cursor-pointer ' +
  'text-fg-muted transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 hover:text-fg-primary focus-visible:outline-none focus-visible:border-accent';

const RECORDER_CLASS =
  'inline-flex items-center h-7 px-2 rounded-xs border border-accent bg-transparent ' +
  'font-mono text-2xs text-fg-secondary cursor-default focus-visible:outline-none';

const NOTE_CLASS =
  'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 rounded-xs border border-edge-subtle ' +
  'text-xs text-fg-secondary';

const NOTE_TEXT_CLASS = 'm-0 flex-1 basis-48 min-w-0 leading-6';

/**
 * One command in the shortcuts list: its name, the chords it answers to,
 * and the controls to change them. Clicking a chord records its
 * replacement; `+` records an extra one.
 */
export function ShortcutRow({ command, chords, customized, recording, recorder, onRemove, onReset }: ShortcutRowProps) {
  const recordingHere = recording.kind !== 'idle' && recording.commandId === command.id;
  const replacing = recordingHere ? recording.replacing : null;
  const addingChord = recordingHere && recording.kind === 'listening' && replacing === null;
  return (
    <li className={ROW_CLASS}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 pt-1">
          <div className="text-sm text-fg-primary">{command.title}</div>
          {command.hint && <div className="text-xs text-fg-faint">{command.hint}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {chords.length === 0 && !addingChord && <span className="text-xs text-fg-faint px-1">Not set</span>}
          {chords.map((chord) => (
            recordingHere && recording.kind === 'listening' && replacing?.equals(chord)
              ? <ChordRecorder key={chord.serialize()} recorder={recorder} />
              : (
                <ChordChip
                  key={chord.serialize()}
                  chord={chord}
                  commandTitle={command.title}
                  onEdit={() => recorder.startRecording(command.id, chord)}
                  onRemove={() => onRemove(chord)}
                />
              )
          ))}
          {addingChord && <ChordRecorder recorder={recorder} />}
          <Tooltip text="Add a shortcut" position="top">
            <button
              type="button"
              className={ICON_BUTTON_CLASS}
              onClick={() => recorder.startRecording(command.id, null)}
              aria-label={`Add a shortcut for ${command.title}`}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
          {customized && (
            <Tooltip text="Restore the default" position="top">
              <button
                type="button"
                className={ICON_BUTTON_CLASS}
                onClick={onReset}
                aria-label={`Restore the default shortcut for ${command.title}`}
              >
                <RotateCcw size={14} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      {recordingHere && (
        <NoteInView>
          <RecordingNote recording={recording} recorder={recorder} />
        </NoteInView>
      )}
    </li>
  );
}

interface ChordChipProps {
  chord: KeyChord;
  commandTitle: string;
  onEdit: () => void;
  onRemove: () => void;
}

function ChordChip({ chord, commandTitle, onEdit, onRemove }: ChordChipProps) {
  const labeler = useKeyChordLabeler();
  const label = labeler.label(chord);
  return (
    <span className={CHORD_CLASS}>
      <button
        type="button"
        className={CHORD_BUTTON_CLASS}
        onClick={onEdit}
        aria-label={`Change ${label} for ${commandTitle}`}
      >
        <KeyChordKeys chord={chord} />
      </button>
      <button
        type="button"
        className={CHORD_REMOVE_CLASS}
        onClick={onRemove}
        aria-label={`Remove ${label} from ${commandTitle}`}
      >
        <X size={10} />
      </button>
    </span>
  );
}

/**
 * Takes focus and hands every keydown to the recording, so nothing else
 * on the page sees the keys being recorded. Letting focus go stops
 * listening.
 */
function ChordRecorder({ recorder }: { recorder: ShortcutRecordingController }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (!recorder.capture(event.nativeEvent)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onBlur = () => {
    if (recorder.recording.kind === 'listening') recorder.cancel();
  };
  return (
    <span
      ref={ref}
      tabIndex={0}
      role="textbox"
      aria-label="Press the new shortcut"
      className={RECORDER_CLASS}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      Press keys…
    </span>
  );
}

/**
 * Scrolls its content into the list's view whenever it changes, since a
 * row near the end of the list would otherwise grow its note out of sight.
 */
function NoteInView({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  });
  return <div ref={ref}>{children}</div>;
}

function RecordingNote({ recording, recorder }: { recording: ShortcutRecording; recorder: ShortcutRecordingController }) {
  if (recording.kind === 'confirming') {
    const owners = recording.conflicts.map((conflict) => conflict.title).join(', ');
    return (
      <div className={NOTE_CLASS} role="status">
        <AlertTriangle size={14} className="shrink-0 text-warning" aria-hidden="true" />
        <p className={NOTE_TEXT_CLASS}>
          <KeyChordKeys chord={recording.chord} /> is already used by <span className="text-fg-primary">{owners}</span>.
        </p>
        <span className="flex items-center gap-2 ml-auto shrink-0">
          <button type="button" className={BTN_SECONDARY_SM} onClick={() => recorder.cancel()}>Cancel</button>
          <button type="button" className={BTN_PRIMARY_SM} onClick={() => recorder.confirm()} autoFocus>Reassign</button>
        </span>
      </div>
    );
  }
  if (recording.kind === 'listening' && recording.refusedChord) {
    return (
      <div className={NOTE_CLASS} role="status">
        <AlertTriangle size={14} className="shrink-0 text-warning" aria-hidden="true" />
        <p className={NOTE_TEXT_CLASS}>
          Your browser keeps <KeyChordKeys chord={recording.refusedChord} /> for itself. Try another, or press Esc to cancel.
        </p>
      </div>
    );
  }
  return <p className="m-0 text-xs text-fg-faint">Press the new shortcut, or Esc to cancel.</p>;
}
