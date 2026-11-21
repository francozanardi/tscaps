import type { ReactNode } from 'react';
import { FolderInput, Library, MonitorPlay, Music, RotateCcw, Trash2 } from 'lucide-react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { POPOVER_ITEM, POPOVER_ITEM_DANGER } from '@ui/pages/editor/features/transcript/transcript-classes';

// As wide as its rows: the shared menu shape's minimum width is sized for longer labels.
const MENU_SHAPE = 'p-1 flex flex-col gap-0.5 max-w-60';
// Where the file stands, above what can be done about it.
const NOTE_CLASS = 'px-2 py-1 mb-0.5 text-3xs leading-snug border-b border-edge-subtle';
const NOTE_TONE_CLASS = {
  ready: 'text-fg-muted',
  busy: 'text-fg-muted',
  alert: 'text-danger',
} as const;

interface MediaFileMenuProps {
  file: MediaAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: { x: number; y: number };
  /** Adds the file to the shot under the playhead; null where it cannot be added to a shot. */
  onAddToCurrentShot: (() => void) | null;
  /** Makes the file the project's music, replacing any there is; null where it is not a sound or already is the music. */
  onUseAsMusic: (() => void) | null;
  onRetry: () => void;
  /** Gives the file to the library when it is the project's, or to the project alone when it is the library's. */
  onMove: () => void;
  /** Shown in place of *Save to library* where saving there is locked; null where it is not. */
  lockedSaveToLibrary: ReactNode;
  /** Asks to delete the file; deleting one still being prepared is how it is cancelled. */
  onDelete: () => void;
}

/** What can be done to one media file, under a line saying where it stands when it is not ready. */
export function MediaFileMenu({ open, onOpenChange, point, ...actions }: MediaFileMenuProps) {
  return <Popover open={open} onOpenChange={onOpenChange} point={point} screens={{ menu: <MenuScreen {...actions} /> }} />;
}

type MenuScreenProps = Pick<MediaFileMenuProps, 'file' | 'onAddToCurrentShot' | 'onUseAsMusic' | 'onRetry' | 'onMove' | 'lockedSaveToLibrary' | 'onDelete'>;

function MenuScreen({ file, onAddToCurrentShot, onUseAsMusic, onRetry, onMove, lockedSaveToLibrary, onDelete }: MenuScreenProps) {
  const { close } = usePopoverNav();
  const view = useMediaAssetStatusView(file.id);
  const run = (action: () => void) => { action(); close(); };
  const inLibrary = file.owner.kind === 'library';
  return (
    <div className={MENU_SHAPE}>
      {view.note !== null && <p className={`${NOTE_CLASS} ${NOTE_TONE_CLASS[view.tone]}`}>{view.note}</p>}
      {onAddToCurrentShot && (
        <button className={POPOVER_ITEM} onClick={() => run(onAddToCurrentShot)}>
          <MonitorPlay size={13} /> Add to current shot
        </button>
      )}
      {onUseAsMusic && (
        <button className={POPOVER_ITEM} onClick={() => run(onUseAsMusic)}>
          <Music size={13} /> Use as music
        </button>
      )}
      {view.retryable && (
        <button className={POPOVER_ITEM} onClick={() => run(onRetry)}>
          <RotateCcw size={13} /> Try again
        </button>
      )}
      {inLibrary ? (
        <button className={POPOVER_ITEM} onClick={() => run(onMove)}>
          <FolderInput size={13} /> Keep only in this project
        </button>
      ) : lockedSaveToLibrary !== null ? (
        lockedSaveToLibrary
      ) : (
        <button className={POPOVER_ITEM} onClick={() => run(onMove)}>
          <Library size={13} /> Save to library
        </button>
      )}
      <button className={POPOVER_ITEM_DANGER} onClick={() => run(onDelete)}>
        <Trash2 size={13} /> Delete
      </button>
    </div>
  );
}
