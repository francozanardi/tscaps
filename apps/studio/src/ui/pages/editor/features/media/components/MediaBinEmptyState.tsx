import type { MediaBinEmptyState as MediaBinEmptyStateCopy } from '@presentation/media/services/MediaBinPresenter';

interface MediaBinEmptyStateProps {
  copy: MediaBinEmptyStateCopy;
  /** Opens the file picker. */
  onChoose: () => void;
}

// The empty scope is a drop zone in look as in fact: the whole tab takes
// a drop, and a click here opens the picker.
const ZONE_CLASS =
  'w-full flex flex-col items-center gap-1 py-8 px-4 rounded-sm border border-dashed border-edge-medium '
  + 'bg-transparent text-center cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:border-edge-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:border-accent';
const TITLE_CLASS = 'text-2xs text-fg-secondary';
const HINT_CLASS = 'text-3xs text-fg-faint leading-snug';

/** What a scope of the media bin shows while it holds no file. */
export function MediaBinEmptyState({ copy, onChoose }: MediaBinEmptyStateProps) {
  return (
    <button type="button" className={ZONE_CLASS} onClick={onChoose}>
      <span className={TITLE_CLASS}>{copy.title}</span>
      <span className={HINT_CLASS}>{copy.hint}</span>
    </button>
  );
}
