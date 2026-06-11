import { memo, useState } from 'react';
import { Undo2, Redo2, ArrowLeft } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { ThemeToggle } from '@ui/_shared/components/ThemeToggle/ThemeToggle';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { ExportButton } from '@ui/export/components/ExportButton';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useTheme } from '@bootstrap/ThemeContext';

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
}

const ICON_BTN =
  'inline-flex items-center justify-center w-8 h-8 bg-transparent border border-transparent rounded-xs text-fg-secondary ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-surface-2 enabled:hover:border-edge-medium enabled:hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const NAME_INPUT =
  'bg-transparent border border-transparent rounded-xs text-fg-primary text-sm lg:text-base font-medium px-2 py-1 lg:py-1.5 ' +
  'min-w-0 lg:min-w-[120px] max-w-[140px] lg:max-w-[320px] truncate ' +
  'transition-colors duration-quick ease-standard outline-none ' +
  'enabled:hover:bg-surface-2 enabled:hover:border-edge-medium ' +
  'focus-visible:bg-surface-2 focus-visible:border-accent ' +
  'disabled:text-fg-muted disabled:cursor-not-allowed';

const SAVE_BTN =
  'inline-flex items-center gap-1.5 px-3 py-1 lg:py-1.5 rounded-xs border border-edge-medium text-sm font-medium ' +
  'text-fg-primary bg-surface-2 ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-surface-3 enabled:hover:border-accent ' +
  'focus-visible:outline-none focus-visible:border-accent ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

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
}: EditorToolbarProps) {
  const uploading = false;
  const { store } = useEditor();
  const theme = useTheme();
  return (
    <div className="w-full flex items-center gap-1 lg:gap-3 px-1 pt-0.5 pb-1 lg:pt-1 lg:pb-2.5 mb-1 lg:mb-3 border-b border-edge-subtle shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        <Tooltip text="Back to dashboard" position="bottom">
          <button
            type="button"
            className={ICON_BTN}
            onClick={onBack}
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={16} />
          </button>
        </Tooltip>
        <NameInput value={projectName} disabled={!canRename} onCommit={onRenameProject} />
      </div>
      <div className="flex items-center gap-1">
        <Tooltip text="Undo (Ctrl+Z)" position="bottom">
          <button
            type="button"
            className={ICON_BTN}
            onClick={() => store.undo()}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
        </Tooltip>
        <Tooltip text="Redo (Ctrl+Y)" position="bottom">
          <button
            type="button"
            className={ICON_BTN}
            onClick={() => store.redo()}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
        </Tooltip>
      </div>

      <div className="flex-1" />

      <div className="hidden lg:flex items-center gap-2">
        {canSave && <ProjectSaveStatusPill dirty={dirty} status={saveStatus} />}
      </div>

      <div className="hidden lg:flex items-center gap-1">
        <ThemeToggle controller={theme} />
      </div>

      {canSave && !uploading && (
        <button
          type="button"
          className={SAVE_BTN}
          onClick={onSave}
          disabled={!dirty || saveStatus === 'saving'}
          aria-label="Save project"
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save'}
        </button>
      )}

      {showExport && !uploading && (
        <ExportButton disabled={exportDisabled} label="Export" onClick={onOpenExportSettings} />
      )}
    </div>
  );
});

interface NameInputProps {
  value: string;
  disabled: boolean;
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
function NameInput({ value, disabled, onCommit }: NameInputProps) {
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
