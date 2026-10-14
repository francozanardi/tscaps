import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import { KeyChordReader } from '@presentation/shortcuts/services/KeyChordReader';
import { ShortcutListBuilder } from '@presentation/shortcuts/services/ShortcutListBuilder';
import {
  ShortcutRecordingController,
  type ShortcutRecording,
} from '@presentation/shortcuts/controllers/ShortcutRecordingController';
import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { ScrollFade } from '@ui/_shared/components/ScrollFade/ScrollFade';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { useShortcuts } from '@ui/_shared/contexts/modules/ShortcutsContext';
import { useShortcutsDialogStore } from '@ui/_shared/contexts/ShortcutsDialogContext';
import { useKeymap } from '@ui/_shared/hooks/useKeymap';
import { useKeyChordLabeler } from '@ui/_shared/hooks/useKeyChordLabeler';
import { ShortcutRow } from '@ui/shortcuts/components/ShortcutRow';

const FILTER_INPUT =
  'w-full bg-surface-1 border border-edge-medium rounded-xs px-3 py-2 text-sm text-fg-primary ' +
  'placeholder:text-fg-faint outline-none transition-colors duration-quick ease-standard ' +
  'hover:border-edge-strong focus-visible:border-accent';

const SECTION_TITLE = 'm-0 mb-1 font-mono text-3xs uppercase tracking-[0.06em] text-fg-faint';

// The list scrolls on its own so the filter above it and the actions
// below it stay in view however long it grows. The height leaves room
// for the dialog's title, description, filter and footer inside the
// dialog's own 85vh cap.
const LIST_FRAME_CLASS = 'relative border-y border-edge-faint';

// Says there is more below, which an overlay scrollbar does not until
// the list is scrolled.
const LIST_FADE_PLACEMENT = 'bottom-0 left-0 right-2 to-surface-2';

const LIST_CLASS =
  'flex flex-col gap-4 max-h-[calc(85vh-16rem)] overflow-y-auto -mx-2 px-2 py-2 ' +
  'thin-scroll [scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.4)_transparent]';

/**
 * The list of every keyboard shortcut, where each one can be changed.
 * Shown while the shortcuts dialog store says so. Changes are kept as
 * they are made; there is nothing to save.
 */
export function ShortcutsDialog() {
  const dialogStore = useShortcutsDialogStore();
  const open = useDialogOpen();
  return (
    <ShortcutsDialogContent
      open={open}
      onDismiss={() => dialogStore.setOpen(false)}
    />
  );
}

function ShortcutsDialogContent({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const shortcuts = useShortcuts();
  const keymap = useKeymap();
  const overrides = useKeymapOverrides();
  const labeler = useKeyChordLabeler();
  const recorder = useMemo(
    () => new ShortcutRecordingController(
      shortcuts.store,
      shortcuts.services.conflictFinder,
      shortcuts.actions.assign,
      new KeyChordReader(),
    ),
    [shortcuts],
  );
  const recording = useRecording(recorder);
  const listBuilder = useMemo(
    () => new ShortcutListBuilder(shortcuts.services.catalog, labeler),
    [shortcuts.services.catalog, labeler],
  );
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => listBuilder.build(keymap, filter), [listBuilder, keymap, filter]);

  const dismiss = () => {
    recorder.cancel();
    setFilter('');
    onDismiss();
  };

  return (
    <AppDialog
      open={open}
      onClose={dismiss}
      locked={recording.kind !== 'idle'}
      size="lg"
      title="Keyboard shortcuts"
      description="Click a shortcut to change it. Changes are kept in this browser."
      showCloseButton
    >
      {/* Keys pressed in here belong to the dialog: nothing behind it,
          such as playback, should answer to them. */}
      <div className="flex flex-col gap-4" onKeyDown={stopKeyPropagation}>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by name or key"
          aria-label="Filter shortcuts"
          spellCheck={false}
          className={FILTER_INPUT}
        />
        <div className={LIST_FRAME_CLASS}>
          <div ref={listRef} className={LIST_CLASS}>
            {sections.length === 0 && (
              <p className="m-0 text-sm text-fg-muted">No shortcut matches “{filter.trim()}”.</p>
            )}
            {sections.map((section) => (
              <section key={section.category}>
                <h3 className={SECTION_TITLE}>{section.title}</h3>
                <ul className="m-0 p-0 list-none">
                  {section.commands.map((command) => (
                    <ShortcutRow
                      key={command.id}
                      command={command}
                      chords={keymap.chordsFor(command.id)}
                      customized={overrides.chordsFor(command.id) !== null}
                      recording={recording}
                      recorder={recorder}
                      onRemove={(chord) => shortcuts.actions.remove.execute({ commandId: command.id, chord })}
                      onReset={() => shortcuts.actions.reset.execute(command.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <ScrollFade scrollRef={listRef} placementClassName={LIST_FADE_PLACEMENT} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={BTN_SECONDARY_SM}
            onClick={() => shortcuts.actions.resetAll.execute()}
            disabled={overrides.isEmpty()}
          >
            Restore all defaults
          </button>
          <button type="button" className={BTN_PRIMARY_SM} onClick={dismiss}>Done</button>
        </div>
      </div>
    </AppDialog>
  );
}

function stopKeyPropagation(event: ReactKeyboardEvent): void {
  event.stopPropagation();
}

function useDialogOpen(): boolean {
  const dialogStore = useShortcutsDialogStore();
  const subscribe = useCallback((notify: () => void) => {
    dialogStore.addEventListener('change', notify);
    return () => dialogStore.removeEventListener('change', notify);
  }, [dialogStore]);
  return useSyncExternalStore(subscribe, () => dialogStore.isOpen);
}

function useKeymapOverrides(): KeymapOverrides {
  const { store } = useShortcuts();
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    return () => store.removeEventListener('change', notify);
  }, [store]);
  return useSyncExternalStore(subscribe, () => store.overrides);
}

function useRecording(recorder: ShortcutRecordingController): ShortcutRecording {
  const subscribe = useCallback((notify: () => void) => {
    recorder.addEventListener('change', notify);
    return () => recorder.removeEventListener('change', notify);
  }, [recorder]);
  return useSyncExternalStore(subscribe, () => recorder.recording);
}
