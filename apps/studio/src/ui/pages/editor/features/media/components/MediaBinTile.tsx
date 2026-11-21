import { memo, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { AlertTriangle, Library, MoreHorizontal } from 'lucide-react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';
import { MediaAssetTileLabels } from '@presentation/media/services/MediaAssetTileLabels';
import type { WaveformPosterSampler } from '@presentation/media/services/WaveformPosterSampler';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { WaveformPoster } from '@ui/pages/editor/features/media/components/WaveformPoster';
import { useMediaAssetPoster, type MediaAssetPosterSamplers } from '@ui/pages/editor/features/media/hooks/useMediaAssetPoster';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { useMediaAssetWaveform } from '@ui/pages/editor/features/media/hooks/useMediaAssetWaveform';
import { MEDIA_ASSET_TYPE_ICONS } from '@ui/pages/editor/features/media/mediaAssetTypeIcons';
import type { MediaFileUsage } from '@presentation/media/services/MediaFileUsage';

interface MediaBinTileProps {
  file: MediaAsset;
  /** What in the open project uses it; absent where nothing does. */
  usage: MediaFileUsage | undefined;
  /** That the file is about to be deleted for not being used, or null when it is not. */
  expiryLabel: string | null;
  /** Whether the tile marks the file as one in the library, among the project's own. */
  marksLibrary: boolean;
  projectId: string | null;
  samplers: MediaAssetPosterSamplers;
  waveformSampler: WaveformPosterSampler;
  dragFormat: MediaAssetDragFormat;
  /** Whether Tab lands on this tile: one tile of the grid at a time. */
  isTabStop: boolean;
  /** Whether this file's own menu is the one open, which marks the tile. */
  isMenuOpen: boolean;
  onFocus: (file: MediaAsset) => void;
  onOpenMenu: (file: MediaAsset, point: { x: number; y: number }) => void;
  onKeyDown: (file: MediaAsset, event: KeyboardEvent<HTMLDivElement>) => void;
}

const LABELS = new MediaAssetTileLabels();

const TILE_CLASS =
  'group relative w-full min-w-0 flex flex-col gap-1 p-1 rounded-sm cursor-pointer select-none '
  + 'bg-surface-2 border border-edge-medium transition-colors duration-quick ease-standard '
  + 'hover:border-edge-strong data-[menu-open]:border-accent '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 '
  + 'focus-visible:ring-offset-surface-1';
const THUMB_CLASS =
  'relative w-full aspect-square rounded-xs overflow-hidden bg-surface-3 '
  + 'inline-flex items-center justify-center text-fg-faint';
// The picture leans in inside its own box, as a shot's poster does.
const POSTER_CLASS =
  'w-full h-full object-cover block transition-transform duration-base ease-standard group-hover:scale-105 '
  + 'group-data-[alert]:opacity-50';
// The waveform leans in like a picture, and keeps clear of the marks along the square's top and bottom.
const WAVEFORM_CLASS =
  'w-full h-full px-2 block transition-transform duration-base ease-standard group-hover:scale-105 '
  + 'group-data-[alert]:opacity-50';
// Over the picture, so they keep the same dark ground whatever it shows. The type and the
// duration share one height and one face, so they read as one family.
const MARK_CLASS =
  'absolute inline-flex items-center h-4 px-1 rounded-xs bg-black/70 text-white pointer-events-none '
  + 'font-mono text-3xs leading-none tabular-nums';
// An icon alone: at the 88px minimum column a word would run into the duration chip.
const LIBRARY_MARK_CLASS = `${MARK_CLASS} bottom-1 left-1`;
const ALERT_MARK_CLASS = 'absolute inset-0 m-auto w-6 h-6 inline-flex items-center justify-center rounded-pill bg-black/70 text-danger';
const OPTIONS_CLASS =
  'absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-xs border-none cursor-pointer '
  + 'bg-black/70 text-white transition-opacity duration-quick ease-standard '
  + 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[menu-open]:opacity-100 '
  + '[@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const PROGRESS_CLASS = 'absolute left-0 bottom-0 h-0.5 bg-accent pointer-events-none transition-[width] duration-base ease-standard';
const NAME_CLASS = 'px-1 text-3xs text-fg-secondary truncate';
const USAGE_CLASS = 'px-1 text-3xs tabular-nums truncate';
// A file about to be deleted for not being used is a caution, not a count.
const USAGE_TONE_CLASS = { count: 'text-fg-faint', expiring: 'text-warning' } as const;
const BADGE_CLASS = 'px-1 font-mono text-3xs uppercase tracking-[0.06em] tabular-nums truncate';
const BADGE_TONE_CLASS = {
  ready: 'text-fg-faint',
  busy: 'text-fg-muted',
  alert: 'text-danger',
} as const;

/**
 * One file in the media bin: its poster (a picture, or an audio file's
 * waveform), what kind of file it is, how long it plays, whether it is
 * in the library (where that is news), its name, and how many shots
 * show it — or, while it is prepared or sent
 * or when it needs the reader, where it stands.
 *
 * Its options open from its button, a right-click, or Enter. It can be
 * dragged, carrying the file's id; what takes the drop decides what to
 * do with it.
 */
export const MediaBinTile = memo(function MediaBinTile(props: MediaBinTileProps) {
  const { file, usage, expiryLabel, marksLibrary, projectId, samplers, waveformSampler, dragFormat, isTabStop, isMenuOpen, onFocus, onOpenMenu, onKeyDown } = props;
  const view = useMediaAssetStatusView(file.id);
  const usageLine = LABELS.usageOf(usage, expiryLabel);
  const usageTone = !LABELS.isUsed(usage) && expiryLabel !== null ? 'expiring' : 'count';
  const poster = useMediaAssetPoster(file, projectId, samplers);
  const waveform = useMediaAssetWaveform(file, projectId, waveformSampler);
  const name = LABELS.nameOf(file);
  const duration = LABELS.durationOf(file);
  const type = LABELS.typeOf(file.type);
  const TypeIcon = MEDIA_ASSET_TYPE_ICONS[file.type];
  const details = LABELS.detailsOf(file);
  const place = marksLibrary ? LABELS.libraryNote() : null;
  const progress = view.progress === null ? null : Math.round(view.progress * 100);

  const openMenuAtPointer = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(file, { x: event.clientX, y: event.clientY });
  };
  const startDrag = (event: DragEvent<HTMLDivElement>) => {
    dragFormat.write(event.dataTransfer, file.id, file.type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const tile = (
    <div
      role="button"
      data-media-id={file.id}
      tabIndex={isTabStop ? 0 : -1}
      aria-haspopup="menu"
      aria-label={[name, type, duration, place, view.badge ?? usageLine].filter(Boolean).join(', ')}
      className={TILE_CLASS}
      data-menu-open={isMenuOpen || undefined}
      data-alert={view.tone === 'alert' || undefined}
      draggable
      onDragStart={startDrag}
      onFocus={() => onFocus(file)}
      onClick={(event) => event.currentTarget.focus()}
      onContextMenu={openMenuAtPointer}
      onKeyDown={(event) => onKeyDown(file, event)}
    >
      <span className={THUMB_CLASS}>
        {poster ? (
          <img src={poster} alt="" className={POSTER_CLASS} draggable={false} />
        ) : waveform ? (
          <WaveformPoster bars={waveform} className={WAVEFORM_CLASS} />
        ) : (
          <TypeIcon size={16} aria-hidden />
        )}
        <span className={`${MARK_CLASS} top-1 left-1 uppercase tracking-[0.06em]`} aria-hidden>{type}</span>
        {duration !== null && <span className={`${MARK_CLASS} bottom-1 right-1`} aria-hidden>{duration}</span>}
        {marksLibrary && <span className={LIBRARY_MARK_CLASS} aria-hidden><Library size={10} /></span>}
        {view.tone === 'alert' && <span className={ALERT_MARK_CLASS} aria-hidden><AlertTriangle size={12} /></span>}
        {progress !== null && <span className={PROGRESS_CLASS} style={{ width: `${progress}%` }} aria-hidden />}
        <button
          type="button"
          tabIndex={-1}
          className={OPTIONS_CLASS}
          aria-label="File options"
          onClick={openMenuAtPointer}
        >
          <MoreHorizontal size={13} />
        </button>
      </span>
      <span className={NAME_CLASS}>{name}</span>
      {view.badge === null ? (
        <span className={`${USAGE_CLASS} ${USAGE_TONE_CLASS[usageTone]}`}>{usageLine}</span>
      ) : (
        <span className={`${BADGE_CLASS} ${BADGE_TONE_CLASS[view.tone]}`}>
          {view.badge}{progress !== null && ` ${progress}%`}
        </span>
      )}
    </div>
  );
  return (
    <Tooltip text={<TileTooltip name={name} details={details} place={place} note={view.note} />}>
      {tile}
    </Tooltip>
  );
});

interface TileTooltipProps {
  name: string;
  details: string;
  /** Where the file lives, when the tile says so. */
  place: string | null;
  note: string | null;
}

function TileTooltip({ name, details, place, note }: TileTooltipProps) {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-fg-primary break-all">{name}</span>
      {details !== '' && <span className="font-mono tabular-nums text-fg-muted">{details}</span>}
      {place !== null && <span className="text-fg-muted">{place}</span>}
      {note !== null && <span>{note}</span>}
    </span>
  );
}
