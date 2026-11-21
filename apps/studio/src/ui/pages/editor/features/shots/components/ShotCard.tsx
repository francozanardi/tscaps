import { memo, useMemo, type MouseEvent } from 'react';
import { FileX, Film, Image, ImagePlay, MoreHorizontal, Pause, Play, Shapes, Video, Volume2 } from 'lucide-react';
import type { ResolvedShot } from '@core/shots/domain/ResolvedShot';
import type { VideoFrameSampler } from '@presentation/shots/services/VideoFrameSampler';
import type { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';
import type { AnchoredSoundsPresenter } from '@presentation/audio-mix/services/AnchoredSoundsPresenter';
import { settingsBtnClass } from '@ui/pages/editor/features/transcript/transcript-classes';
import { useShotPoster } from '@ui/pages/editor/features/shots/hooks/useShotPoster';
import { useEditorCuts } from '@ui/_shared/contexts/EditorStoreContext';
import { useShotOutputSpan } from '@ui/pages/editor/features/shots/hooks/useShotOutputSpan';
import { useMediaAssetProxy } from '@ui/pages/editor/features/media/hooks/useMediaAssetProxy';
import { useMediaAssetDropTarget } from '@ui/pages/editor/features/media/hooks/useMediaAssetDropTarget';
import { ShotProgressEdge } from '@ui/pages/editor/features/shots/components/ShotProgressEdge';
import { ShotLayerChip } from '@ui/pages/editor/features/shots/components/ShotLayerChip';
import { ShotAttachmentPill } from '@ui/pages/editor/features/shots/components/ShotAttachmentPill';
import { ShotAddButton } from '@ui/pages/editor/features/shots/components/ShotAddButton';
import { useShotLayers } from '@ui/pages/editor/features/shots/hooks/useShotLayers';
import { useContinuingShotLayers } from '@ui/pages/editor/features/shots/hooks/useContinuingShotLayers';
import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { SHOT_FILE_TYPES } from '@ui/pages/editor/features/shots/shotFileAccept';
import type { ShotSettingsScreen } from '@ui/pages/editor/features/shots/components/ShotSettingsPopover';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';

const LABELS = new ShotLayerLabels();
// What a layer continuing from an earlier shot is drawn with, and the screen about it, by what it shows.
const CONTINUING_ICON = { video: Film, image: Image, gif: ImagePlay, graphic: Shapes } as const;
const CONTINUING_SCREEN = { video: 'broll', image: 'picture', gif: 'picture', graphic: 'graphic' } as const;

interface ShotCardProps {
  shot: ResolvedShot;
  index: number;
  /** Whether the playhead is inside it. */
  isActive: boolean;
  /** Whether it is playing now, which turns its play button into a pause. */
  isPlaying: boolean;
  /**
   * The screen this shot's own popover was opened on while it is the one
   * open, null otherwise: it pins the button that opened it, *Add* for
   * the add screen and the settings button for the rest.
   */
  openedScreen: ShotSettingsScreen | null;
  /** Whether either end of it can move, which only a video of one shot rules out. */
  canEditTiming: boolean;
  /** Ratio of the video the poster is taken from, so the frame is never distorted. */
  aspectRatio: number | null;
  /** What the video's posters are taken from; null while there is nothing to sample. */
  posterSource: Blob | null;
  videoSampler: VideoFrameSampler;
  /** Samples the b-roll posters, which cover the box the video's frame would fill. */
  brollSampler: VideoFrameSampler;
  projectId: string | null;
  onSelect: (shot: ResolvedShot) => void;
  onPlay: (shot: ResolvedShot) => void;
  onPause: () => void;
  /** `layerId` names the layer the screen is about — a picture, a GIF, a missing file — for the screens about one. */
  onOpenSettings: (shot: ResolvedShot, point: { x: number; y: number }, screen: ShotSettingsScreen, layerId?: string) => void;
  onOpenWord: (shot: ResolvedShot, pieceIndex: number, point: { x: number; y: number }) => void;
  /** How a file dragged from the media bin is recognised. */
  dragFormat: MediaAssetDragFormat;
  /** Shows a file dropped on the card on its shot: a video as its b-roll, a picture or a GIF on top. */
  onDropFile: (shot: ResolvedShot, mediaId: string) => void;
  /**
   * While the panel is picking layers, the ones picked; null otherwise.
   * Then a pill picks its layer instead of opening it, and the card
   * opens no popover of its own.
   */
  pickedLayerIds: ReadonlySet<string> | null;
  /** A press on a layer's pill while picking; `extendRange` with Shift held. */
  onPickLayer: (layerId: string, extendRange: boolean) => void;
  /**
   * Opens the settings of a layer an earlier shot holds and this one
   * still shows, on the screen about it, where its pill was pressed.
   */
  onOpenContinuingLayer: (shot: ResolvedShot, point: { x: number; y: number }, screen: ShotSettingsScreen, layerId: string) => void;
  /** The number, as the cards count them, of the shot holding each layer, by layer id. */
  layerShotNumbers: ReadonlyMap<string, number>;
  /**
   * The layers showing over the whole video, which are said once above
   * the shots: a card leaves them out, except while the panel picks
   * layers, when a card is where every layer is picked from.
   */
  wholeVideoLayerIds: ReadonlySet<string>;
  /** What the shot's camera does — the preset it was given, `Zoom in` — or null where it leaves the video as the frame crops it. */
  cameraLabel: string | null;
  /**
   * The camera of an earlier shot still running over this one: what it
   * does and the number of the shot it belongs to; null where this
   * shot's video is its own.
   */
  continuingCamera: { readonly label: string; readonly fromShotNumber: number } | null;
  /** Opens the settings of the camera running over this shot from an earlier one, where its pill was pressed. */
  onOpenContinuingCamera: (shot: ResolvedShot, point: { x: number; y: number }) => void;
  /** The Original words some sound effect is on, by id. */
  wordsWithSounds: ReadonlySet<string>;
  soundsPresenter: AnchoredSoundsPresenter;
}

// Raised off the panel it sits on, so each shot reads as a thing of its own.
const CARD_CLASS =
  'group relative overflow-hidden w-full flex items-stretch gap-2.5 p-1.5 text-left rounded-sm cursor-pointer '
  + 'bg-surface-2 border border-edge-medium '
  + 'transition-colors duration-quick ease-standard '
  + 'hover:border-edge-strong '
  + 'data-[active]:border-accent '
  // A file from the media bin held over it: this is where it lands.
  + 'data-[drop-target]:border-accent data-[drop-target]:bg-surface-3 '
  // Cut away entirely: still there, since cuts come back, but it plays nothing.
  + 'data-[cut]:opacity-60';

const POSTER_CLASS =
  'relative shrink-0 w-[72px] p-0 border-none rounded-xs overflow-hidden bg-surface-3 self-start cursor-pointer '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
// Shown on hover, held while the shot plays, and always there where
// nothing can hover.
const PLAY_BADGE_CLASS =
  'absolute inset-0 m-auto w-6 h-6 inline-flex items-center justify-center rounded-pill '
  + 'bg-black/70 backdrop-blur-sm text-white pointer-events-none '
  + 'transition-opacity duration-quick ease-standard '
  + 'group-hover:opacity-100 [@media(hover:none)]:opacity-100';
// The frame leans in inside its own box, which keeps its size: the card
// answers the pointer without anything around it moving.
const POSTER_IMAGE_CLASS =
  'w-full h-full object-cover block transition-transform duration-base ease-standard group-hover:scale-105';
const INDEX_CLASS = 'font-mono text-3xs text-fg-faint/60 tabular-nums';
const DURATION_CLASS = 'font-mono text-2xs text-fg-secondary tabular-nums';
// The value chips' hover underline, so the one number on the card that
// can be edited answers the pointer the way they do.
const DURATION_BUTTON_CLASS =
  `${DURATION_CLASS} p-0 bg-transparent border-0 border-b border-transparent cursor-pointer `
  + 'transition-colors duration-quick ease-standard '
  + 'hover:border-edge-medium hover:text-fg-primary focus-visible:outline-none focus-visible:border-accent';
// The words are context, not the subject: one tone below the card's own
// chrome, and never the typography the transcript edits them in.
const TEXT_CLASS = 'text-2xs text-fg-faint leading-snug m-0';
// A word carrying sounds says so as quietly as the words do: no hue.
const SOUND_MARK_CLASS = 'inline-block ml-1 align-baseline text-fg-muted';
const WORD_CLASS =
  'rounded-[2px] px-[1px] cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:bg-accent/15 hover:text-fg-secondary';
// A word cut away whole plays nothing, so nothing can be put on it: struck through, and it answers no press.
const CUT_WORD_CLASS = 'px-[1px] line-through decoration-fg-faint/70 opacity-60';

/**
 * One shot: the frame it opens on — its b-roll's, once that file is
 * ready — how long it runs, the words spoken inside it, and what it
 * shows over the video.
 *
 * Led by the picture on purpose. A scene card in the transcript is
 * text and is edited as text; this is a stretch of footage, and the
 * two must not be mistaken for each other.
 *
 * Pressing it moves the playhead there and nothing else. Everything
 * that changes a shot is a popover away: the card's own from the
 * settings button, a right-click or its duration, a word's from the word.
 * What the shot carries sits under the words, one pill each, and each
 * opens its own part of that popover; the row ends in *Add*, which opens
 * what can be put on it. A word a sound is on carries a small speaker
 * mark.
 *
 * What an earlier shot holds and this one still shows leads that row,
 * each a quieter pill marked as continuing; pressing one opens the same
 * settings its own shot's pill opens.
 *
 * A file dragged from the media bin can be dropped on it to show on
 * the shot; anything else dragged over it is not taken.
 *
 * While the panel picks layers, its pills pick them instead and its
 * popovers are out of reach, so a press can only mean one thing.
 */
export const ShotCard = memo(function ShotCard(props: ShotCardProps) {
  const {
    shot, index, isActive, isPlaying, onPlay, onPause, openedScreen, canEditTiming, aspectRatio,
    posterSource, videoSampler, brollSampler, projectId, onSelect, onOpenSettings, onOpenWord, dragFormat, onDropFile,
    pickedLayerIds, onPickLayer, onOpenContinuingLayer, layerShotNumbers, wholeVideoLayerIds, cameraLabel, continuingCamera, onOpenContinuingCamera, wordsWithSounds, soundsPresenter,
  } = props;
  const isPicking = pickedLayerIds !== null;
  const drop = useMediaAssetDropTarget(dragFormat, SHOT_FILE_TYPES, (mediaId) => onDropFile(shot, mediaId));
  const onCard = useMemo(() => {
    const shown = (layers: ReadonlyArray<ShotLayer>) => (
      isPicking || wholeVideoLayerIds.size === 0 ? layers : layers.filter((layer) => !wholeVideoLayerIds.has(layer.id))
    );
    return { own: shown(shot.layers), continuing: shown(shot.continuingLayers) };
  }, [shot.layers, shot.continuingLayers, wholeVideoLayerIds, isPicking]);
  const { broll, pictures, graphics, missing } = useShotLayers(onCard.own);
  const continuing = useContinuingShotLayers(onCard.continuing);
  const brollProxy = useMediaAssetProxy(projectId, broll?.mediaId ?? null);
  const brollPoster = useShotPoster(brollSampler, brollProxy, broll?.inSec ?? 0);
  const videoPoster = useShotPoster(videoSampler, posterSource, shot.startSec);
  const poster = brollPoster ?? videoPoster;
  const span = useShotOutputSpan(shot.startSec, shot.endSec);
  const cuts = useEditorCuts();
  // Cut away whole, it plays nothing: nothing on it opens, until the cut is restored.
  const isInert = span.isCutAway;
  const openAt = (screen: ShotSettingsScreen, layerId?: string) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isPicking && !isInert) onOpenSettings(shot, { x: event.clientX, y: event.clientY }, screen, layerId);
  };
  // A layer's pill: picks it while picking, opens its screen otherwise.
  const pressLayer = (screen: ShotSettingsScreen, layerId: string) => (event: MouseEvent) => {
    if (isInert) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!isPicking) {
      openAt(screen, layerId)(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'click') onPickLayer(layerId, event.shiftKey);
  };
  // The pill of a layer an earlier shot holds: picks it while picking, opens its own settings otherwise.
  const pressContinuing = (kind: ShotLayerAsset['kind'], layerId: string) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (isInert) return;
    if (isPicking) {
      if (event.type === 'click') onPickLayer(layerId, event.shiftKey);
      return;
    }
    onOpenContinuingLayer(shot, { x: event.clientX, y: event.clientY }, CONTINUING_SCREEN[kind], layerId);
  };
  const continuesNote = (layerId: string) => {
    const from = layerShotNumbers.get(layerId);
    return from === undefined ? 'Continues from an earlier shot' : `Continues from shot ${from}`;
  };
  const duration = span.isCutAway ? 'Cut' : `${span.durationSec.toFixed(1)}s`;
  // Either button on a word answers about the word, never the card around it.
  const openWordAt = (event: MouseEvent, pieceIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isPicking) onOpenWord(shot, pieceIndex, { x: event.clientX, y: event.clientY });
  };
  return (
    <div
      className={CARD_CLASS}
      data-active={isActive || undefined}
      data-cut={span.isCutAway || undefined}
      data-drop-target={drop.isOver || undefined}
      {...(isInert ? {} : drop.handlers)}
      onClick={() => onSelect(shot)}
      onContextMenu={openAt('menu')}
      role="presentation"
    >
      <button
        type="button"
        className={POSTER_CLASS}
        style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
        aria-label={isPlaying ? 'Pause' : 'Play this shot'}
        disabled={isInert}
        onClick={(event) => {
          event.stopPropagation();
          if (isPlaying) onPause();
          else onPlay(shot);
        }}
      >
        {poster && <img src={poster} alt="" className={POSTER_IMAGE_CLASS} />}
        <span className={`${PLAY_BADGE_CLASS} ${isPlaying ? 'opacity-100' : 'opacity-0'}`} aria-hidden>
          {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-px" />}
        </span>
      </button>
      <span className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className={INDEX_CLASS}>{String(index + 1).padStart(2, '0')}</span>
          <span className="flex items-center gap-1.5">
            {canEditTiming && !span.isCutAway && !isPicking ? (
              <button type="button" className={DURATION_BUTTON_CLASS} aria-label="Edit timing" onClick={openAt('timing')}>
                {duration}
              </button>
            ) : (
              <span className={DURATION_CLASS}>{duration}</span>
            )}
            {!isPicking && (
              <button
                type="button"
                className={`${settingsBtnClass(openedScreen !== null && openedScreen !== 'add', 'seg-header')} disabled:opacity-40 disabled:cursor-default`}
                aria-label="Shot options"
                disabled={isInert}
                onClick={openAt('menu')}
              >
                <MoreHorizontal size={13} />
              </button>
            )}
          </span>
        </span>
        <p className={TEXT_CLASS}>
          {shot.pieces.map((piece, pieceIndex) => {
            const isCut = cuts.containsTimeRange(piece.startSec, piece.endSec);
            return (
            <span key={`${piece.startSec}-${piece.text}`}>
              {pieceIndex > 0 && ' '}
              <span
                className={isCut ? CUT_WORD_CLASS : isPicking ? undefined : WORD_CLASS}
                onClick={isCut ? undefined : (event) => openWordAt(event, pieceIndex)}
                onContextMenu={isCut ? undefined : (event) => openWordAt(event, pieceIndex)}
                aria-disabled={isCut || undefined}
                title={isCut ? 'Cut' : undefined}
                role="presentation"
              >
                {piece.text}
                {soundsPresenter.marksSound(piece, shot.startSec, wordsWithSounds) && (
                  <Volume2 size={10} className={SOUND_MARK_CLASS} aria-label="Has a sound" />
                )}
              </span>
            </span>
            );
          })}
        </p>
        {(!isPicking || broll || pictures.length > 0 || graphics.length > 0 || continuing.length > 0) && (
          <span className="flex flex-wrap gap-1 pt-0.5">
            {continuingCamera !== null && !isPicking && (
              <ShotAttachmentPill
                label={continuingCamera.label}
                icon={Video}
                tone="ready"
                progress={null}
                note={`Continues from shot ${continuingCamera.fromShotNumber}`}
                continues
                onOpen={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!isInert) onOpenContinuingCamera(shot, { x: event.clientX, y: event.clientY });
                }}
              />
            )}
            {continuing.map(({ layer, kind }) => ('mediaId' in layer ? (
              <ShotLayerChip
                key={layer.id}
                mediaId={layer.mediaId}
                label={LABELS.labelOf(kind)}
                icon={CONTINUING_ICON[kind]}
                picked={pickedLayerIds?.has(layer.id)}
                continuesNote={continuesNote(layer.id)}
                onOpen={pressContinuing(kind, layer.id)}
              />
            ) : (
              <ShotAttachmentPill
                key={layer.id}
                label={LABELS.labelOf(kind)}
                icon={CONTINUING_ICON[kind]}
                tone="ready"
                progress={null}
                note={continuesNote(layer.id)}
                picked={pickedLayerIds?.has(layer.id)}
                continues
                onOpen={pressContinuing(kind, layer.id)}
              />
            )))}
            {broll && (
              <ShotLayerChip
                mediaId={broll.mediaId}
                label={LABELS.labelOf('video')}
                icon={Film}
                picked={pickedLayerIds?.has(broll.id)}
                onOpen={pressLayer('broll', broll.id)}
              />
            )}
            {pictures.map(({ layer, kind }) => (
              <ShotLayerChip
                key={layer.id}
                mediaId={layer.mediaId}
                label={LABELS.labelOf(kind)}
                icon={kind === 'gif' ? ImagePlay : Image}
                picked={pickedLayerIds?.has(layer.id)}
                onOpen={pressLayer('picture', layer.id)}
              />
            ))}
            {graphics.map((layer) => (
              <ShotAttachmentPill
                key={layer.id}
                label={LABELS.labelOf('graphic')}
                icon={Shapes}
                tone="ready"
                progress={null}
                note={null}
                picked={pickedLayerIds?.has(layer.id)}
                onOpen={pressLayer('graphic', layer.id)}
              />
            ))}
            {cameraLabel !== null && !isPicking && (
              <ShotAttachmentPill label={cameraLabel} icon={Video} tone="ready" progress={null} note={null} onOpen={openAt('camera')} />
            )}
            {/* A layer whose file is gone has nothing to edit together: it is not picked, only removed on its own. */}
            {!isPicking && missing.map((layer) => (
              <ShotLayerChip
                key={layer.id}
                mediaId={layer.mediaId}
                label={LABELS.labelOf(null)}
                icon={FileX}
                onOpen={openAt('missing', layer.id)}
              />
            ))}
            {!isPicking && <ShotAddButton isOpen={openedScreen === 'add'} disabled={isInert} onOpen={openAt('add')} />}
          </span>
        )}
      </span>
      {isActive && <ShotProgressEdge startSec={shot.startSec} endSec={shot.endSec} />}
    </div>
  );
});
