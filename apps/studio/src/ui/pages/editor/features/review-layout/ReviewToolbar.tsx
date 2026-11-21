import { memo } from 'react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { ThemeToggle } from '@ui/_shared/components/ThemeToggle/ThemeToggle';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import { NameInput, UndoRedoButtons } from '@ui/pages/editor/components/EditorToolbar';
import { TOOLBAR_BUTTON } from '@ui/pages/editor/components/toolbar-buttons';
import { EditHistoryButton } from '@ui/pages/editor/features/history/EditHistoryButton';
import { useReviewNotes } from '@ui/_shared/contexts/modules/ReviewNotesContext';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';
import { useTheme } from '@bootstrap/ThemeContext';
import type { ReviewMarkingStore } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { useReviewMarkingToggle } from '@ui/pages/editor/features/review-notes/hooks/useReviewMarkingToggle';
import { ReviewMarkingToggleIcon } from '@ui/pages/editor/features/review-notes/components/ReviewMarkingToggleIcon';

interface ReviewToolbarProps {
  projectName: string;
  canRename: boolean;
  onRenameProject: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  /** How many notes wait to be sent. */
  draftCount: number;
  /** How many sent notes the agent has not resolved yet. */
  sentCount: number;
  showExport: boolean;
  exportDisabled: boolean;
  onOpenExportSettings: () => void;
  onOpenFullEditor: () => void;
  /** The frame's marking, which a button here starts where the frame's own tools cannot be found (a phone, a tablet). */
  reviewMarking: ReviewMarkingStore;
}

/** The mark button while the tools are offered or the frame is being marked: filled in the accent, as the frame's picked tool is. */
const MARKING =
  'inline-flex items-center gap-1.5 px-3 py-1 lg:py-1.5 rounded-xs border border-transparent text-sm font-medium '
  + 'bg-accent text-fg-on-accent cursor-pointer transition-colors duration-quick ease-standard hover:bg-accent-hover '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * The review layout's top bar, laid out as the editor's own: the project
 * and the way back through the history on the left; on the right, the
 * notes the agent holds, the full editor, the export, and the bar's one
 * accent action, sending the person's notes to the agent. Where the
 * frame's own marking tools cannot be found, a button here starts
 * marking notes on it, and stops it.
 */
export const ReviewToolbar = memo(function ReviewToolbar({
  projectName,
  canRename,
  onRenameProject,
  canUndo,
  canRedo,
  draftCount,
  sentCount,
  showExport,
  exportDisabled,
  onOpenExportSettings,
  onOpenFullEditor,
  reviewMarking,
}: ReviewToolbarProps) {
  const markingToggle = useReviewMarkingToggle(reviewMarking);
  const reviewNotes = useReviewNotes();
  const { projectName: projectNameRules } = useProjects();
  const theme = useTheme();
  const sendLabel = draftCount === 0 ? 'Send to agent' : `Send ${draftCount} ${draftCount === 1 ? 'note' : 'notes'} to agent`;
  const sendHint = draftCount === 0
    ? 'Comment on the video or draw on it first: your notes go to the agent together'
    : 'Send your notes to the agent as one review';
  return (
    <div className="w-full flex items-center gap-1 lg:gap-3 px-1 pt-0.5 pb-1 lg:pt-1 lg:pb-2.5 mb-1 lg:mb-3 border-b border-edge-subtle shrink-0">
      <div className="hidden lg:flex min-w-0">
        <NameInput value={projectName} disabled={!canRename} maxLength={projectNameRules.maxLength} onCommit={onRenameProject} />
      </div>
      <div className="flex items-center gap-1">
        <UndoRedoButtons canUndo={canUndo} canRedo={canRedo} />
        <div className="hidden lg:flex">
          <EditHistoryButton />
        </div>
      </div>

      <div className="flex-1" />

      {sentCount > 0 && (
        <div className="hidden lg:flex items-center">
          <StatusPill label={`${sentCount} ${sentCount === 1 ? 'note' : 'notes'} with the agent`} tone="info" />
        </div>
      )}

      <div className="hidden lg:flex items-center gap-1">
        <ThemeToggle controller={theme} />
      </div>

      {markingToggle !== null && (
        <Tooltip text={markingToggle.label} position="bottom">
          <button
            type="button"
            className={markingToggle.active || markingToggle.choosing ? MARKING : TOOLBAR_BUTTON}
            onClick={markingToggle.toggle}
            aria-label={markingToggle.label}
            aria-pressed={markingToggle.active || markingToggle.choosing}
            data-review-mark
          >
            <ReviewMarkingToggleIcon toggle={markingToggle} size={14} />
            <span className="max-lg:hidden">Mark</span>
          </button>
        </Tooltip>
      )}
      <Tooltip text="Every panel of the editor, to change anything by hand" position="bottom">
        <button type="button" className={TOOLBAR_BUTTON} onClick={onOpenFullEditor} data-review-open-editor>
          <span className="max-lg:hidden">Open full editor</span>
          <span className="lg:hidden">Full editor</span>
        </button>
      </Tooltip>
      {showExport && (
        <button type="button" className={TOOLBAR_BUTTON} onClick={onOpenExportSettings} disabled={exportDisabled}>
          Export
        </button>
      )}
      <Tooltip text={sendHint} position="bottom">
        <button
          type="button"
          className={BTN_PRIMARY_SM}
          onClick={() => reviewNotes.actions.submit.execute()}
          disabled={draftCount === 0}
          data-review-send
        >
          <span className="tabular-nums max-lg:hidden">{sendLabel}</span>
          <span className="tabular-nums lg:hidden">{draftCount === 0 ? 'Send' : `Send ${draftCount}`}</span>
        </button>
      </Tooltip>
    </div>
  );
});
