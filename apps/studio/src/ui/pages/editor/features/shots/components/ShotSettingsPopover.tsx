import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AudioLines, ChevronsDown, ChevronsUp, Clock3, Film, ImagePlus, Replace, RotateCcw, Scissors, Shapes, SlidersHorizontal, Trash2, Upload, Video,
} from 'lucide-react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotTimeGrid } from '@presentation/shots/services/ShotTimeGrid';
import { useMediaAssetStatusView } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatusView';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useShotOutputSpan } from '@ui/pages/editor/features/shots/hooks/useShotOutputSpan';
import { useShotLayerPlacementForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerPlacementForm';
import { ShotFileChoices } from '@ui/pages/editor/features/shots/components/ShotFileChoices';
import {
  ShotLayerDurationItem, ShotLayerDurationScreen, SHOT_LAYER_DURATION_SCREEN, type ShotLayerDurationData,
} from '@ui/pages/editor/features/shots/components/ShotLayerDuration';
import { PICTURE_FILE_ACCEPT, VIDEO_FILE_ACCEPT } from '@ui/pages/editor/features/shots/shotFileAccept';
import {
  POPOVER_MENU_SHAPE,
  POPOVER_ITEM,
  POPOVER_ITEM_DANGER,
} from '@ui/pages/editor/features/transcript/transcript-classes';

// How far either end can be dragged in one pass, in output time. The
// whole video as a range puts every second of a long one inside a few
// pixels. The window is fixed where the screen opened: one that followed
// the value would slide under the pointer mid-drag.
const REACH_SEC = 5;
const TIME_GRID = new ShotTimeGrid();
const SOUND_COUNT_CLASS = 'ml-auto pl-2 font-mono text-3xs text-fg-faint tabular-nums';

export type ShotSettingsScreen =
  | 'menu' | 'add' | 'timing' | 'broll' | 'broll-pick' | 'picture' | 'picture-pick' | 'graphic' | 'missing' | 'camera'
  | typeof SHOT_LAYER_DURATION_SCREEN;

/** The graphic on a shot that the graphic screen is about. */
export interface ShotGraphicData {
  /** What it is called: the preset it still is, or *Custom* once its code was edited. */
  readonly name: string;
  /** Where it sits. */
  readonly placement: ShotLayerPlacement;
}

/** The picture or GIF on a shot that the picture screens are about. */
export interface ShotPictureData {
  readonly mediaId: string;
  readonly kind: 'image' | 'gif';
  /** Its file, or null when the file was deleted. */
  readonly asset: MediaAsset | null;
  /** Where it sits. */
  readonly placement: ShotLayerPlacement;
}

/** Times are source time, as the shot holds them; the screens show them as the output plays. */
interface ShotSettingsData {
  startSec: number;
  endSec: number;
  /** Where the shots either side open, which is as far as each end can go. */
  previousStartSec: number | null;
  nextEndSec: number | null;
  onJoinWithPrevious: (() => void) | null;
  onJoinWithNext: (() => void) | null;
  /** Absent on the first shot, which opens where the video does. */
  onMoveStart: ((sec: number) => void) | null;
  /** Absent on the last shot, whose end is the end of the video. */
  onMoveEnd: ((sec: number) => void) | null;
  /** The id of the file this shot shows over the video, or null when it shows the video. */
  brollMediaId: string | null;
  /** That file, or null when it shows the video or the file was deleted. */
  broll: MediaAsset | null;
  /** The videos a b-roll can be picked from: the project's own and the library's. */
  library: ReadonlyArray<MediaAsset>;
  onUploadBroll: (file: File) => void;
  onPickBroll: (mediaId: string) => void;
  onRemoveBroll: () => void;
  onRetryBroll: () => void;
  /** Where the b-roll sits, or null when the shot has none. */
  brollPlacement: ShotLayerPlacement | null;
  /** The picture or GIF the picture screens are about, or null when they are about none. */
  picture: ShotPictureData | null;
  /** The pictures and GIFs one can be picked from: the project's own and the library's. */
  pictureLibrary: ReadonlyArray<MediaAsset>;
  /** Puts a picture or a GIF on top of the shot. */
  onUploadPicture: (file: File) => void;
  onPickPicture: (mediaId: string) => void;
  onRemovePicture: () => void;
  onRetryPicture: () => void;
  /** The file of the layer the missing-file screen is about — one the open project does not hold — or null. */
  missingMediaId: string | null;
  /** Takes that layer off the shot. */
  onRemoveMissing: () => void;
  /** Picks the b-roll to edit its layout and timing beside the preview. */
  onEditBroll: () => void;
  /** Picks the picture or GIF to edit its layout beside the preview. */
  onEditPicture: () => void;
  /** Puts a new graphic on top of the shot and opens it beside the preview. */
  onAddGraphic: () => void;
  /** The graphic the graphic screen is about, or null when it is about none. */
  graphic: ShotGraphicData | null;
  /** Picks that graphic to edit it beside the preview. */
  onEditGraphic: () => void;
  /** Takes that graphic off the shot. */
  onRemoveGraphic: () => void;
  /** Opens the shot's inspector on its camera, in place of the list of shots. */
  onOpenCamera: () => void;
  /** Opens the shot's inspector on its sounds, in place of the list of shots. */
  onOpenSounds: () => void;
  /** How many sounds belong to the shot, as its inspector's *Sound* lists them. */
  soundCount: number;
  /** Cuts the whole shot out of the video, as a cut of the timeline that can be restored. */
  onCut: () => void;
  /**
   * How long what the screen is about shows, and the shots it could end
   * with: a layer for a layer's screen, the shot's camera for the camera
   * screen; null where the screen is about neither.
   */
  duration: ShotLayerDurationData | null;
  /** What the shot's camera does, as its pill names it, or null where it has none. */
  cameraLabel: string | null;
  /** Takes the shot's camera away, with its sounds. */
  onRemoveCamera: () => void;
  projectId: string | null;
}

interface ShotSettingsPopoverProps extends ShotSettingsData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: { x: number; y: number };
  initialScreen: ShotSettingsScreen;
}

/**
 * Everything that can be said about one shot. Its menu — joining,
 * timing, cutting — is reached by right-click anywhere on its card, or
 * from the card's settings button; what can be put on it — a b-roll, a
 * picture or a GIF, a graphic, a camera move, a sound — from the card's
 * *Add* button.
 *
 * Its camera and its sounds are edited in its inspector, which the add
 * screen opens on either.
 *
 * Moving an end moves the boundary it shares with a neighbour, so the
 * shot beside it grows or shrinks by the same amount. The first shot
 * opens where the video does and the last ends where it ends; neither
 * of those is a boundary, so neither can be moved.
 */
export function ShotSettingsPopover({ open, onOpenChange, point, initialScreen, ...data }: ShotSettingsPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      point={point}
      initialScreen={initialScreen}
      screens={{
        menu: <ShotMenuScreen {...data} />,
        add: <ShotAddScreen {...data} />,
        timing: <ShotTimingScreen {...data} />,
        broll: <ShotBrollScreen {...data} />,
        'broll-pick': <ShotBrollPickScreen {...data} />,
        picture: <ShotPictureScreen {...data} />,
        'picture-pick': <ShotPicturePickScreen {...data} />,
        graphic: <ShotGraphicScreen {...data} />,
        missing: <ShotMissingFileScreen {...data} />,
        camera: <ShotCameraScreen {...data} />,
        [SHOT_LAYER_DURATION_SCREEN]: data.duration === null ? null : <ShotLayerDurationScreen {...data.duration} />,
      }}
    />
  );
}

/** What changes the shot itself: where it starts and ends, joining it to a neighbour, cutting it away. */
function ShotMenuScreen({ startSec, endSec, onJoinWithPrevious, onJoinWithNext, onMoveStart, onMoveEnd, onCut }: ShotSettingsData) {
  const { navigate, close } = usePopoverNav();
  const span = useShotOutputSpan(startSec, endSec);
  const run = (action: () => void) => { action(); close(); };
  return (
    <div className={POPOVER_MENU_SHAPE}>
      {onJoinWithPrevious && (
        <button className={POPOVER_ITEM} onClick={() => run(onJoinWithPrevious)}>
          <ChevronsUp size={13} /> Join with previous shot
        </button>
      )}
      {onJoinWithNext && (
        <button className={POPOVER_ITEM} onClick={() => run(onJoinWithNext)}>
          <ChevronsDown size={13} /> Join with next shot
        </button>
      )}
      {(onMoveStart || onMoveEnd) && !span.isCutAway && (
        <button className={POPOVER_ITEM} onClick={() => navigate('timing')}>
          <Clock3 size={13} /> Edit timing
        </button>
      )}
      {!span.isCutAway && (
        <button className={POPOVER_ITEM} onClick={() => run(onCut)}>
          <Scissors size={13} /> Cut
        </button>
      )}
    </div>
  );
}

/**
 * What can be put on the shot. A b-roll is offered only while it has
 * none: the one it has is reached from its pill, which replaces it.
 */
function ShotAddScreen(data: ShotSettingsData) {
  const { brollMediaId, onAddGraphic, onOpenCamera, onOpenSounds, soundCount } = data;
  const { close } = usePopoverNav();
  const brollSource = useBrollSource(data, close);
  const pictureSource = usePictureSource(data, close);
  const run = (action: () => void) => { action(); close(); };
  return (
    <div className={POPOVER_MENU_SHAPE}>
      {brollMediaId === null && (
        <button className={POPOVER_ITEM} onClick={brollSource.choose}>
          <Film size={13} /> B-roll
        </button>
      )}
      <button className={POPOVER_ITEM} onClick={pictureSource.choose}>
        <ImagePlus size={13} /> Picture or GIF
      </button>
      <button className={POPOVER_ITEM} onClick={() => run(onAddGraphic)}>
        <Shapes size={13} /> Graphic
      </button>
      <button className={POPOVER_ITEM} onClick={() => run(onOpenCamera)}>
        <Video size={13} /> Camera move
      </button>
      <button className={POPOVER_ITEM} onClick={() => run(onOpenSounds)}>
        <AudioLines size={13} /> Sound
        {soundCount > 0 && <span className={SOUND_COUNT_CLASS}>{soundCount}</span>}
      </button>
      {brollSource.input}
      {pictureSource.input}
    </div>
  );
}

function ShotTimingScreen({ startSec, endSec, previousStartSec, nextEndSec, onMoveStart, onMoveEnd }: ShotSettingsData) {
  const timeMap = useRenderTimeMap();
  const toOutput = (sec: number) => timeMap.toOutputTime(sec);
  const start = toOutput(startSec);
  const end = toOutput(endSec);
  const [anchor] = useState({ start, end });
  const step = TIME_GRID.stepSec;
  // An empty range means the neighbour on that side plays nothing, and has no room to give.
  // Each range's ends sit on the grid: the slider and its typed value both step from the minimum.
  const startRange = previousStartSec === null ? null : {
    min: TIME_GRID.ceil(Math.max(toOutput(previousStartSec) + step, anchor.start - REACH_SEC)),
    max: TIME_GRID.floor(Math.min(end - step, anchor.start + REACH_SEC)),
  };
  const endRange = nextEndSec === null ? null : {
    min: TIME_GRID.ceil(Math.max(start + step, anchor.end - REACH_SEC)),
    max: TIME_GRID.floor(Math.min(toOutput(nextEndSec) - step, anchor.end + REACH_SEC)),
  };
  return (
    <div className="p-2 w-[300px] box-border flex flex-col gap-2">
      {onMoveStart && startRange && startRange.max > startRange.min && (
        <Slider
          label="Starts"
          value={start}
          min={startRange.min}
          max={startRange.max}
          step={step}
          unit="s"
          compact
          onChange={(sec) => onMoveStart(timeMap.toSourceTime(TIME_GRID.snap(sec)))}
        />
      )}
      {onMoveEnd && endRange && endRange.max > endRange.min && (
        <Slider
          label="Ends"
          value={end}
          min={endRange.min}
          max={endRange.max}
          step={step}
          unit="s"
          compact
          onChange={(sec) => onMoveEnd(timeMap.toSourceTime(TIME_GRID.snap(sec)))}
        />
      )}
      <p className="text-3xs text-fg-faint leading-snug m-0">
        The shot on the other side of each end grows or shrinks to meet it.
      </p>
    </div>
  );
}

function ShotBrollScreen(data: ShotSettingsData) {
  const { brollMediaId, broll, onRemoveBroll, onRetryBroll, brollPlacement, onEditBroll, duration } = data;
  const { close } = usePopoverNav();
  const brollSource = useBrollSource(data, close);
  const view = useMediaAssetStatusView(brollMediaId ?? '');
  const form = useShotLayerPlacementForm();
  const layoutSummary = brollPlacement === null ? null : form.layoutLabel(brollPlacement.kind);
  if (brollMediaId === null) return null;
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <div className="px-2 py-1 flex flex-col gap-0.5 max-w-[240px]">
        <span className="text-2xs text-fg-primary truncate">{broll ? broll.fileName : 'Deleted file'}</span>
        {view.note !== null && (
          <span className={`text-3xs leading-snug ${view.tone === 'alert' ? 'text-danger/85' : 'text-fg-faint'}`}>
            {view.note}
          </span>
        )}
      </div>
      <button className={POPOVER_ITEM} onClick={() => { onEditBroll(); close(); }}>
        <SlidersHorizontal size={13} className="shrink-0" /> Edit
        <span className="ml-auto pl-2 min-w-0 truncate text-fg-faint">{layoutSummary}</span>
      </button>
      {view.retryable && (
        <button className={POPOVER_ITEM} onClick={onRetryBroll}>
          <RotateCcw size={13} /> Try again
        </button>
      )}
      <button className={POPOVER_ITEM} onClick={brollSource.choose}>
        <Replace size={13} /> Replace
      </button>
      {duration !== null && <ShotLayerDurationItem {...duration} />}
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onRemoveBroll(); close(); }}>
        <Trash2 size={13} /> Remove
      </button>
      {brollSource.input}
    </div>
  );
}

/**
 * Where a b-roll comes from: a new file first, then any the project
 * already holds, so a clip used once can be used again without sending
 * it twice.
 */
function ShotBrollPickScreen(data: ShotSettingsData) {
  const { brollMediaId, library, onPickBroll } = data;
  const { close } = usePopoverNav();
  const brollSource = useBrollSource(data, close);
  return (
    <FilePickScreen
      uploadLabel="Upload a video"
      source={brollSource}
      choices={library.filter((media) => media.id !== brollMediaId)}
      onPick={(id) => { onPickBroll(id); close(); }}
    />
  );
}

/**
 * Where a picture or a GIF comes from: a new file first, then any the
 * project already holds. Each pick adds one on top of the shot.
 */
function ShotPicturePickScreen(data: ShotSettingsData) {
  const { pictureLibrary, onPickPicture } = data;
  const { close } = usePopoverNav();
  const pictureSource = usePictureSource(data, close);
  return (
    <FilePickScreen
      uploadLabel="Upload a picture or GIF"
      source={pictureSource}
      choices={pictureLibrary}
      onPick={(id) => { onPickPicture(id); close(); }}
    />
  );
}

/** A new file first, then the project's files and the library's, each group under its label. */
function FilePickScreen({ uploadLabel, source, choices, onPick }: {
  uploadLabel: string;
  source: FileSource;
  choices: ReadonlyArray<MediaAsset>;
  onPick: (mediaId: string) => void;
}) {
  return (
    <div className={`${POPOVER_MENU_SHAPE} max-w-[260px]`}>
      <button className={POPOVER_ITEM} onClick={source.upload}>
        <Upload size={13} /> {uploadLabel}
      </button>
      {source.input}
      {choices.length > 0 && (
        <>
          <div className="mx-2 my-1 border-t border-edge-subtle" />
          <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
            <ShotFileChoices choices={choices} onPick={onPick} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One picture or GIF on the shot: its file and where it stands, where it
 * sits, how long it shows, and taking it off the shot. The file stays in
 * the project.
 */
function ShotPictureScreen(data: ShotSettingsData) {
  const { picture, onRemovePicture, onRetryPicture, onEditPicture, duration } = data;
  const { close } = usePopoverNav();
  const view = useMediaAssetStatusView(picture?.mediaId ?? '');
  const form = useShotLayerPlacementForm();
  if (picture === null) return null;
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <div className="px-2 py-1 flex flex-col gap-0.5 max-w-[240px]">
        <span className="text-2xs text-fg-primary truncate">{picture.asset ? picture.asset.fileName : 'Deleted file'}</span>
        {view.note !== null && (
          <span className={`text-3xs leading-snug ${view.tone === 'alert' ? 'text-danger/85' : 'text-fg-faint'}`}>
            {view.note}
          </span>
        )}
      </div>
      <button className={POPOVER_ITEM} onClick={() => { onEditPicture(); close(); }}>
        <SlidersHorizontal size={13} className="shrink-0" /> Edit
        <span className="ml-auto pl-2 min-w-0 truncate text-fg-faint">
          {form.layoutLabel(picture.placement.kind)}
        </span>
      </button>
      {view.retryable && (
        <button className={POPOVER_ITEM} onClick={onRetryPicture}>
          <RotateCcw size={13} /> Try again
        </button>
      )}
      {duration !== null && <ShotLayerDurationItem {...duration} />}
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onRemovePicture(); close(); }}>
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

/**
 * A graphic on the shot, as a b-roll's screen offers its file: editing it,
 * which is also where another preset is picked, how long it shows, and
 * taking it off.
 */
function ShotGraphicScreen({ graphic, onEditGraphic, onRemoveGraphic, duration }: ShotSettingsData) {
  const { close } = usePopoverNav();
  const form = useShotLayerPlacementForm();
  if (graphic === null) return null;
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <div className="px-2 py-1 flex flex-col gap-0.5 max-w-[240px]">
        <span className="text-2xs text-fg-primary truncate">{graphic.name}</span>
      </div>
      <button className={POPOVER_ITEM} onClick={() => { onEditGraphic(); close(); }}>
        <SlidersHorizontal size={13} className="shrink-0" /> Edit
        <span className="ml-auto pl-2 min-w-0 truncate text-fg-faint">{form.layoutLabel(graphic.placement.kind)}</span>
      </button>
      {duration !== null && <ShotLayerDurationItem {...duration} />}
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onRemoveGraphic(); close(); }}>
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

/**
 * The shot's camera, as a layer's screen offers a layer: editing it
 * beside the preview, how long it runs, and taking it away.
 */
function ShotCameraScreen({ cameraLabel, onOpenCamera, onRemoveCamera, duration }: ShotSettingsData) {
  const { close } = usePopoverNav();
  if (cameraLabel === null) return null;
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <div className="px-2 py-1 flex flex-col gap-0.5 max-w-[240px]">
        <span className="text-2xs text-fg-primary truncate">{cameraLabel}</span>
      </div>
      <button className={POPOVER_ITEM} onClick={() => { onOpenCamera(); close(); }}>
        <SlidersHorizontal size={13} className="shrink-0" /> Edit
      </button>
      {duration !== null && <ShotLayerDurationItem {...duration} />}
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onRemoveCamera(); close(); }}>
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

/**
 * A layer whose file the open project no longer holds — deleted here or
 * on another device. What it was cannot be known, so nothing draws it
 * and it offers only what it says and taking it off the shot.
 */
function ShotMissingFileScreen({ missingMediaId, onRemoveMissing }: ShotSettingsData) {
  const { close } = usePopoverNav();
  const view = useMediaAssetStatusView(missingMediaId ?? '');
  if (missingMediaId === null) return null;
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <div className="px-2 py-1 flex flex-col gap-0.5 max-w-[240px]">
        <span className="text-2xs text-fg-primary truncate">Deleted file</span>
        {view.note !== null && <span className="text-3xs leading-snug text-danger/85">{view.note}</span>}
      </div>
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onRemoveMissing(); close(); }}>
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

interface FileSource {
  /** Offers the files to pick from, or goes straight to a new one when there is nothing else to pick. */
  choose: () => void;
  upload: () => void;
  /** The file input; rendered by the screen, which stays open while the picker is up. */
  input: ReactNode;
}

/**
 * Picking a b-roll from a screen. The popover stays open while the
 * system picker is up: closing it would take the input, and the file it
 * is about to hand over, with it.
 */
function useBrollSource({ brollMediaId, library, onUploadBroll }: ShotSettingsData, close: () => void): FileSource {
  return useFileSource({
    hasChoices: library.some((media) => media.id !== brollMediaId),
    pickScreen: 'broll-pick',
    accept: VIDEO_FILE_ACCEPT,
    onUpload: onUploadBroll,
  }, close);
}

/** Picking a picture or a GIF from a screen, the way {@link useBrollSource} picks a b-roll. */
function usePictureSource({ pictureLibrary, onUploadPicture }: ShotSettingsData, close: () => void): FileSource {
  return useFileSource({
    hasChoices: pictureLibrary.length > 0,
    pickScreen: 'picture-pick',
    accept: PICTURE_FILE_ACCEPT,
    onUpload: onUploadPicture,
  }, close);
}

/** Offers the files to pick from on `pickScreen`, or goes straight to a new one when there is nothing to pick. */
function useFileSource(
  { hasChoices, pickScreen, accept, onUpload }: {
    hasChoices: boolean;
    pickScreen: ShotSettingsScreen;
    accept: string;
    onUpload: (file: File) => void;
  },
  close: () => void,
): FileSource {
  const { navigate } = usePopoverNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = () => inputRef.current?.click();
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onUpload(file);
    close();
  };
  return {
    choose: () => (hasChoices ? navigate(pickScreen) : upload()),
    upload,
    input: <input ref={inputRef} type="file" accept={accept} onChange={handleFile} hidden />,
  };
}
