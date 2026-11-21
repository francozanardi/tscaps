import { useMemo, useState } from 'react';
import { History, Sparkles } from 'lucide-react';
import { HistoryGraphLayout, type HistoryGraphRow } from '@presentation/editor/services/HistoryGraphLayout';
import { HistoryCheckpointDescriber } from '@presentation/editor/services/HistoryCheckpointDescriber';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useEditHistory } from '@ui/pages/editor/hooks/useEditHistory';
import { HISTORY_ROW_HEIGHT, HistoryGraphCell } from '@ui/pages/editor/features/history/components/HistoryGraphCell';

const layout = new HistoryGraphLayout();
const describer = new HistoryCheckpointDescriber();

const BUTTON =
  'inline-flex items-center justify-center w-8 h-8 bg-transparent border border-transparent rounded-xs ' +
  'text-fg-secondary cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-surface-2 enabled:hover:border-edge-medium enabled:hover:text-fg-primary ' +
  'data-[state=open]:bg-surface-2 data-[state=open]:border-edge-medium data-[state=open]:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const ROW =
  'w-full flex items-center gap-2 pr-3 text-left bg-transparent border-none rounded-xs cursor-pointer ' +
  'transition-colors duration-quick ease-standard hover:bg-surface-3 ' +
  'focus-visible:outline-none focus-visible:bg-surface-3';

/**
 * The editor toolbar's history button: a popover with every checkpoint of
 * the edit history drawn as a graph, newest first, each with what changed,
 * who changed it and when. Picking one shows the project as it was there;
 * nothing is lost, since what came after stays in the graph as a branch.
 */
export function EditHistoryButton() {
  const { store } = useEditor();
  const history = useEditHistory();
  const [open, setOpen] = useState(false);
  // Times read "4 min ago" from when the popover opened, and hold still while it is open.
  const [openedAtMs, setOpenedAtMs] = useState(0);
  const changeOpen = (next: boolean) => {
    if (next) setOpenedAtMs(Date.now());
    setOpen(next);
  };
  const graph = useMemo(() => layout.layOut(history), [history]);
  const shownRow = graph.rows.findIndex((row) => row.isShown);
  const onlyStart = history.checkpoints.length <= 1;
  const emptyHint = 'Every change you make shows up here.';

  return (
    <Popover
      open={open}
      onOpenChange={changeOpen}
      side="bottom"
      align="start"
      sideOffset={8}
      focusOnOpen="popover"
      triggerTooltip="History"
      trigger={(
        <button type="button" className={BUTTON} aria-label="History">
          <History size={16} />
        </button>
      )}
      screens={{
        graph: (
          <div className="w-80 flex flex-col gap-2 p-3">
            <PopoverHeader title="History" />
            {onlyStart ? (
              <p className="m-0 text-xs text-fg-muted">{emptyHint}</p>
            ) : (
              <p className="m-0 text-xs text-fg-muted">Go back to any moment. Nothing gets lost.</p>
            )}
            <ol className="m-0 p-0 list-none max-h-96 overflow-y-auto" aria-label="Checkpoints">
              {graph.rows.map((row, index) => (
                <li key={row.checkpoint.id}>
                  <button
                    type="button"
                    className={ROW}
                    style={{ height: HISTORY_ROW_HEIGHT }}
                    aria-current={row.isShown ? 'step' : undefined}
                    onClick={() => store.jumpToCheckpoint(row.checkpoint.id)}
                  >
                    <HistoryGraphCell row={row} laneCount={graph.laneCount} belowShown={index > shownRow} />
                    <CheckpointText row={row} nowMs={openedAtMs} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ),
      }}
    />
  );
}

function CheckpointText({ row, nowMs }: { row: HistoryGraphRow; nowMs: number }) {
  const { checkpoint } = row;
  const muted = !row.onShownPath;
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2" title={describer.editsOf(checkpoint) ?? undefined}>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className={`truncate text-sm ${muted ? 'text-fg-muted' : 'text-fg-primary'} ${row.isShown ? 'font-medium' : ''}`}>
          {describer.titleOf(checkpoint)}
        </span>
        <span className="flex items-center gap-1 text-2xs text-fg-faint tabular-nums">
          {checkpoint.author === 'assistant' && <Sparkles size={11} aria-hidden />}
          {describer.metaOf(checkpoint, nowMs)}
        </span>
      </span>
      {row.isShown && <StatusPill label="Now" tone="info" />}
      {row.isSaved && !row.isShown && <StatusPill label="Saved" />}
    </span>
  );
}
