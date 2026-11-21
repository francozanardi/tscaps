import { memo, useState, type ReactNode } from 'react';
import { Undo2, Redo2, ArrowLeft } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { ThemeToggle } from '@ui/_shared/components/ThemeToggle/ThemeToggle';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { ExportButton } from '@ui/pages/editor/features/export/components/ExportButton';
import { SupportButton } from '@ui/pages/editor/features/support/SupportButton';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { HistoryCheckpointDescriber } from '@presentation/editor/services/HistoryCheckpointDescriber';
import { EditHistoryButton } from '@ui/pages/editor/features/history/EditHistoryButton';
import { useEditHistory } from '@ui/pages/editor/hooks/useEditHistory';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useTheme } from '@bootstrap/ThemeContext';
import { useAppExit } from '@bootstrap/AppExitContext';
import { useShortcutLabel } from '@ui/_shared/hooks/useShortcutLabel';
import { ShortcutsButton } from '@ui/shortcuts/ShortcutsButton';
import { TOOLBAR_BUTTON, TOOLBAR_ICON_BUTTON } from '@ui/pages/editor/components/toolbar-buttons';

export type SaveButtonStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  showExport: boolean;
  exportDisabled: boolean;
  onOpenExportSettings: () => void;
  projectName: string;
  canRename: boolean;
  onRenameProject: (name: string) => void;
  onBack: () => void;
  dirty: boolean;
  saveStatus: SaveButtonStatus;
  canSave: boolean;
  onSave: () => void;
  /** A control right after the way back to the dashboard. Pass a memoized element: the toolbar is memoized. */
  leadingControl?: ReactNode;
  /** Whether the way back to the dashboard is offered; a page driven from outside keeps the person on its project. */
  canLeave?: boolean;
}

const NAME_INPUT =
  'bg-transparent border border-transparent rounded-xs text-fg-primary text-sm lg:text-base font-medium px-2 py-1 lg:py-1.5 ' +
  'min-w-0 lg:min-w-[120px] max-w-[140px] lg:max-w-[320px] truncate ' +
  'transition-colors duration-quick ease-standard outline-none ' +
  'enabled:hover:bg-surface-2 enabled:hover:border-edge-medium ' +
  'focus-visible:bg-surface-2 focus-visible:border-accent ' +
  'disabled:text-fg-muted disabled:cursor-not-allowed';

export const EditorToolbar = memo(function EditorToolbar({
  canUndo,
  canRedo,
  showExport,
  exportDisabled,
  onOpenExportSettings,
  projectName,
  canRename,
  onRenameProject,
  onBack,
  dirty,
  saveStatus,
  canSave,
  onSave,
  leadingControl,
  canLeave = true,
}: EditorToolbarProps) {
  const uploading = false;
  const supportButton = <SupportButton />;
  const { projectName: projectNameRules } = useProjects();
  const theme = useTheme();
  const dashboardAvailable = useAppExit() === null && canLeave;
  return (
    <div className="w-full flex items-center gap-1 lg:gap-3 px-1 pt-0.5 pb-1 lg:pt-1 lg:pb-2.5 mb-1 lg:mb-3 border-b border-edge-subtle shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        {dashboardAvailable && (
          <Tooltip text="Back to dashboard" position="bottom">
            <button
              type="button"
              className={TOOLBAR_ICON_BUTTON}
              onClick={onBack}
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={16} />
            </button>
          </Tooltip>
        )}
        {leadingControl}
        {/* A phone's toolbar keeps to what an edit needs: the name is renamed from the dashboard, and the
            checkpoints popover has no room to read on a screen that narrow. */}
        <div className="hidden lg:flex min-w-0">
          <NameInput
            value={projectName}
            disabled={!canRename}
            maxLength={projectNameRules.maxLength}
            onCommit={onRenameProject}
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <UndoRedoButtons canUndo={canUndo} canRedo={canRedo} />
        <div className="hidden lg:flex">
          <EditHistoryButton />
        </div>
      </div>

      <div className="flex-1" />

      <div className="hidden lg:flex items-center gap-2">
        {canSave && <ProjectSaveStatusPill dirty={dirty} status={saveStatus} />}
      </div>

      <div className="hidden lg:flex items-center gap-1">
        <ThemeToggle controller={theme} />
        <ShortcutsButton />
        {supportButton}
      </div>

      {canSave && !uploading && (
        <button
          type="button"
          className={TOOLBAR_BUTTON}
          onClick={onSave}
          disabled={!dirty || saveStatus === 'saving'}
          aria-label="Save project"
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save'}
        </button>
      )}

      {showExport && (
        <ExportButton disabled={exportDisabled} label="Export" onClick={onOpenExportSettings} />
      )}
    </div>
  );
});

const historyDescriber = new HistoryCheckpointDescriber();

/** Undo and Redo, each saying in its tooltip which change it would take back or bring back. */
export function UndoRedoButtons({ canUndo, canRedo }: { canUndo: boolean; canRedo: boolean }) {
  const { store } = useEditor();
  const history = useEditHistory();
  const undoShortcutLabel = useShortcutLabel('edit.undo');
  const redoShortcutLabel = useShortcutLabel('edit.redo');
  const undoTitle = historyDescriber.undoTitleOf(history);
  const redoTitle = historyDescriber.redoTitleOf(history);
  const undoText = `Undo${undoTitle === null ? '' : `: ${undoTitle}`}${undoShortcutLabel ? ` (${undoShortcutLabel})` : ''}`;
  const redoText = `Redo${redoTitle === null ? '' : `: ${redoTitle}`}${redoShortcutLabel ? ` (${redoShortcutLabel})` : ''}`;
  return (
    <>
      <Tooltip text={undoText} position="bottom">
        <button type="button" className={TOOLBAR_ICON_BUTTON} onClick={() => store.undo()} disabled={!canUndo} aria-label="Undo">
          <Undo2 size={16} />
        </button>
      </Tooltip>
      <Tooltip text={redoText} position="bottom">
        <button type="button" className={TOOLBAR_ICON_BUTTON} onClick={() => store.redo()} disabled={!canRedo} aria-label="Redo">
          <Redo2 size={16} />
        </button>
      </Tooltip>
    </>
  );
}

interface NameInputProps {
  value: string;
  disabled: boolean;
  maxLength: number;
  onCommit: (name: string) => void;
}

/**
 * Editable project name. Local state lets the user type without
 * auto-save thrashing; the value is committed on blur or Enter. Escape
 * rolls back to the last-committed value.
 *
 * Stays in sync with prop changes by re-syncing local state when
 * `value` changes from the outside while the input is not focused.
 */
export function NameInput({ value, disabled, maxLength, onCommit }: NameInputProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (!focused && value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      className={NAME_INPUT}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Project name"
      placeholder="Untitled"
    />
  );
}

interface ProjectSaveStatusPillProps {
  dirty: boolean;
  status: SaveButtonStatus;
}

function ProjectSaveStatusPill({ dirty, status }: ProjectSaveStatusPillProps) {
  if (status === 'saving') return <StatusPill label="Saving" tone="info" active />;
  if (status === 'error') return <StatusPill label="Save failed" tone="danger" />;
  if (status === 'saved' && !dirty) return <StatusPill label="Saved" tone="subtle" />;
  if (dirty) return <StatusPill label="Unsaved changes" tone="warning" />;
  return null;
}
