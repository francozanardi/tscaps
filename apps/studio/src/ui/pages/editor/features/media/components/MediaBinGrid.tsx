import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';
import type { MediaFileUsage } from '@presentation/media/services/MediaFileUsage';
import type { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';
import { MediaBinGridNavigator } from '@presentation/media/services/MediaBinGridNavigator';
import { MediaBinTile } from '@ui/pages/editor/features/media/components/MediaBinTile';
import type { MediaAssetPosterSamplers } from '@ui/pages/editor/features/media/hooks/useMediaAssetPoster';

interface MediaBinGridProps {
  files: readonly MediaAsset[];
  /** What in the open project uses each file, by id; a file nothing uses is absent. */
  usage: ReadonlyMap<string, MediaFileUsage>;
  /** What a file's tile says when the file is about to be deleted for not being used; null when it is not. */
  expiryLabelOf: (fileId: string) => string | null;
  projectId: string | null;
  samplers: MediaAssetPosterSamplers;
  /** What an audio file's waveform poster is drawn with. */
  waveformSampler: WaveformPosterSampler;
  dragFormat: MediaAssetDragFormat;
  /** The file whose menu is open, if any. */
  openMenuId: string | null;
  /** Whether a library file's tile carries the library mark: where the grid mixes library files with others. */
  marksLibraryFiles: boolean;
  /** Names the grid for assistive tech. */
  label: string;
  onOpenMenu: (file: MediaAsset, point: { x: number; y: number }) => void;
  onDelete: (file: MediaAsset) => void;
}

const NAVIGATOR = new MediaBinGridNavigator();

// As many columns as fit tiles of at least 88px: three in the sidebar's
// usual width, more when it is pulled wider.
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2';

/**
 * The files of one scope as a grid of tiles, walked with the arrow
 * keys, Home and End. Tab enters the grid once, on the tile last
 * focused; Enter, Space or the menu key open a tile's options, Delete
 * asks to delete it.
 */
export function MediaBinGrid({ files, usage, expiryLabelOf, projectId, samplers, waveformSampler, dragFormat, openMenuId, marksLibraryFiles, label, onOpenMenu, onDelete }: MediaBinGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const tabStopId = files.some((file) => file.id === focusedId) ? focusedId : files[0]?.id ?? null;

  const columns = useCallback((): number => {
    const grid = gridRef.current;
    if (!grid) return 1;
    return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  }, []);

  const onFocus = useCallback((file: MediaAsset) => setFocusedId(file.id), []);

  const onKeyDown = useCallback((file: MediaAsset, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    // Kept from the editor's own shortcuts, which read the arrows and Space off the window.
    const claim = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    const index = files.findIndex((candidate) => candidate.id === file.id);
    if (NAVIGATOR.isGridKey(event.key)) {
      claim();
      const next = files[NAVIGATOR.next(index, event.key, files.length, columns())];
      if (next) gridRef.current?.querySelector<HTMLElement>(`[data-media-id="${CSS.escape(next.id)}"]`)?.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      claim();
      const box = event.currentTarget.getBoundingClientRect();
      onOpenMenu(file, { x: box.left, y: box.bottom });
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      claim();
      onDelete(file);
    }
  }, [files, columns, onOpenMenu, onDelete]);

  return (
    <div ref={gridRef} className={GRID_CLASS} role="list" aria-label={label}>
      {files.map((file) => (
        <div key={file.id} role="listitem" className="min-w-0">
          <MediaBinTile
            file={file}
            usage={usage.get(file.id)}
            expiryLabel={expiryLabelOf(file.id)}
            marksLibrary={marksLibraryFiles && file.owner.kind === 'library'}
            projectId={projectId}
            samplers={samplers}
            waveformSampler={waveformSampler}
            dragFormat={dragFormat}
            isTabStop={file.id === tabStopId}
            isMenuOpen={file.id === openMenuId}
            onFocus={onFocus}
            onOpenMenu={onOpenMenu}
            onKeyDown={onKeyDown}
          />
        </div>
      ))}
    </div>
  );
}
