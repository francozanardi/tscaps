import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ShotFileOrigin } from '@core/shots/services/ShotEditTelemetryReporter';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Document } from '@tscaps/engine';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { AppError } from '@core/errors/domain/AppError';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { ResolvedShot } from '@core/shots/domain/ResolvedShot';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';
import { ShotLayerSelectionModeController } from '@presentation/shots/controllers/ShotLayerSelectionModeController';
import { SelectableShotLayerReader } from '@presentation/shots/services/SelectableShotLayerReader';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';
import { ShotLayerSelectMenu } from '@presentation/shots/services/ShotLayerSelectMenu';
import { ShotOutputLengths } from '@presentation/shots/services/ShotOutputLengths';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { ShotCard } from '@ui/pages/editor/features/shots/components/ShotCard';
import { ShotSeam } from '@ui/pages/editor/features/shots/components/ShotSeam';
import { ShotSettingsPopover, type ShotSettingsScreen } from '@ui/pages/editor/features/shots/components/ShotSettingsPopover';
import type { ShotLayerDurationData } from '@ui/pages/editor/features/shots/components/ShotLayerDuration';
import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { PICTURE_FILE_TYPES, VIDEO_FILE_TYPES } from '@ui/pages/editor/features/shots/shotFileAccept';
import { ShotWordPopover } from '@ui/pages/editor/features/shots/components/ShotWordPopover';
import { ShotsWholeVideoRow } from '@ui/pages/editor/features/shots/components/ShotsWholeVideoRow';
import { ShotsActionsPopover } from '@ui/pages/editor/features/shots/components/ShotsActionsPopover';
import { ShotLayerSelectionHeader } from '@ui/pages/editor/features/shots/components/ShotLayerSelectionHeader';
import { ShotLayerSelectionBar } from '@ui/pages/editor/features/shots/components/ShotLayerSelectionBar';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';
import { useActiveShotId } from '@ui/pages/editor/features/shots/hooks/useActiveShotId';
import { useShotPlayback } from '@ui/pages/editor/features/shots/hooks/useShotPlayback';
import { useVirtualListAutoScroll } from '@ui/pages/editor/hooks/useVirtualListAutoScroll';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { LocateButton } from '@ui/pages/editor/components/LocateButton';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useCuts, useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import { useRetryMediaAsset } from '@ui/pages/editor/features/media/hooks/useRetryMediaAsset';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { useOverlaySelectionController } from '@ui/pages/editor/contexts/OverlaySelectionContext';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { useEditorAudioMix, useEditorCuts } from '@ui/_shared/contexts/EditorStoreContext';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useAudioTabPresenter } from '@ui/pages/editor/features/audio/hooks/useAudioTabPresenter';
import { useAudioTimingContext } from '@ui/pages/editor/features/audio/hooks/useAudioTimingContext';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';

// Held by id: the shot itself is re-read on every render, so an edit
// made from the popover shows up in it.
interface OpenPopover {
  shotId: string;
  point: { x: number; y: number };
}

interface OpenShotPopover extends OpenPopover {
  screen: ShotSettingsScreen;
  /** The picture or GIF the picture screens are about. */
  layerId: string | null;
  /** The shot whose card was pressed: `shotId`, but for a layer asked about on a later shot it still shows on. */
  pressedShotId: string;
}

interface OpenWordPopover extends OpenPopover {
  pieceIndex: number;
}

interface ShotsTabProps {
  /** The Original track's words, whatever caption track is active: shots are about the video. */
  originalDocument: Document | null;
  /** The sheets the Original track's sections route to. */
  originalSheets: ReadonlyArray<Sheet>;
  /** The Original track's emoji edits: with its sheets, which of its emojis show. */
  originalDecorationOverrides: DecorationOverrideRegistry;
  shots: ShotPartition;
  videoDurationSec: number;
  /** Where the source's picture changes abruptly; null where nobody looked. */
  pictureChangesSec: ReadonlyArray<number> | null;
  /** What the posters are taken from — the proxy where there is one, the original otherwise. */
  posterSource: Blob | null;
  videoAspectRatio: number | null;
  isPlaying: boolean;
  projectId: string | null;
}

const DRAG_FORMAT = new MediaAssetDragFormat();
const LABELS = new ShotLayerLabels();
const SELECT_MENU = new ShotLayerSelectMenu();

const EMPTY_CLASS = 'text-2xs text-fg-faint leading-snug m-0 py-6 text-center';

const REPROPOSE_WARNING =
  'This replaces your shots with new automatic ones. The changes you made to them will be lost.';

/**
 * The video cut into shots: a stretch of footage at a time, each one
 * the place where what it shows is decided.
 *
 * A shot is not a caption scene. Scenes are text and their division
 * follows the template; shots are the picture and answer to nobody
 * but this panel. Everything that changes a shot is a popover away:
 * the card's own, or a word's, which is where a new shot can open.
 *
 * Layers can also be picked several at a time, from the header's menu:
 * then the pills pick instead of open, and a bar under the list edits
 * or removes every layer picked at once.
 */
export const ShotsTab = memo(function ShotsTab(props: ShotsTabProps) {
  const { originalDocument, originalSheets, originalDecorationOverrides, shots, videoDurationSec, pictureChangesSec, posterSource, videoAspectRatio, isPlaying, projectId } = props;
  const media = useMediaAssets();
  const playback = usePlayback();
  const { services, actions } = useShots();
  const cuts = useCuts();
  const editorCuts = useEditorCuts();
  const mediaModule = useMedia();
  const { appNoticeChannel } = useErrors();
  const overlaySelection = useOverlaySelectionController();
  const soundsPresenter = useAnchoredSoundsPresenter();
  const audioTab = useAudioTabPresenter();
  const audioContext = useAudioTimingContext(
    { document: originalDocument, sheets: originalSheets, decorationOverrides: originalDecorationOverrides },
    shots,
    videoDurationSec,
  );
  const workspace = useEditorWorkspaceStore();
  const audioMix = useEditorAudioMix();
  const wordsWithSounds = useMemo(() => soundsPresenter.wordsWithSounds(audioMix), [soundsPresenter, audioMix]);
  const [openShot, setOpenShot] = useState<OpenShotPopover | null>(null);
  const [openWord, setOpenWord] = useState<OpenWordPopover | null>(null);
  const [pendingMaxShotSec, setPendingMaxShotSec] = useState<number | null>(null);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const isVisible = useActiveEditorMode() === 'video';

  // The proposal stands in until one edit makes it the user's own;
  // from then on nothing recomputes, so a transcript edit can never
  // move a shot somebody decided on.
  const partition = useMemo(
    () => services.materializer.materialize(shots, {
      document: originalDocument,
      videoDurationSec,
      sheets: originalSheets,
      pictureChangesSec,
      cuts: editorCuts,
    }),
    [services, shots, originalDocument, videoDurationSec, originalSheets, pictureChangesSec, editorCuts],
  );
  const motionForm = useShotLayerMotionForm();
  // What a shot's card says its camera does: the preset it was given, or that it was set by hand.
  const cameraLabelOf = (shotId: string): string | null => {
    const layerId = ShotVideoLayerId.of(shotId);
    const style = partition.layerStyles.get(layerId);
    const animation = style?.animations?.[ElementAnimationScope.CAMERA];
    if (motionForm.cameraOf(style?.fields, animation).isUntouched()) return null;
    return motionForm.pickedLabelOf(animation) ?? 'Camera';
  };
  // The camera of an earlier shot whose video is drawn over this one, with the number of the shot it belongs to.
  const continuingCameraOf = (shotId: string): { label: string; fromShotNumber: number } | null => {
    const owner = partition.videoShotOf(shotId);
    if (owner === null || owner.id === shotId) return null;
    const label = cameraLabelOf(owner.id);
    return label === null ? null : { label, fromShotNumber: partition.list().indexOf(owner) + 1 };
  };
  const resolved = useMemo(
    () => services.resolver.resolve(partition, originalDocument, videoDurationSec),
    [services, partition, originalDocument, videoDurationSec],
  );
  // The shot holding each layer, as the cards number them: what a pill continuing on a later card says it comes from.
  const layerShotNumbers = useMemo(
    () => new Map(partition.list().flatMap((shot, index) => shot.layers.map((layer) => [layer.id, index + 1] as const))),
    [partition],
  );
  const timeMap = useRenderTimeMap();
  const shotLengths = useMemo(() => ShotOutputLengths.of(resolved, timeMap), [resolved, timeMap]);
  // What shows over the whole video is said once, above the shots, and left off the cards.
  const wholeVideoLayers = useMemo(() => partition.wholeVideoLayers(), [partition]);
  const wholeVideoLayerIds = useMemo(() => new Set(wholeVideoLayers.map((layer) => layer.id)), [wholeVideoLayers]);
  const videoSampler = useVideoFrameSampler();
  const brollSampler = useVideoFrameSampler();
  // The card that reads as picked is always the one playing, so an edit
  // from a popover never looks like it landed on another shot.
  const activeShotId = useActiveShotId(partition);

  const layerSelection = useMemo(() => new ShotLayerSelectionModeController(), []);
  const subscribeToLayerSelection = useCallback((notify: () => void) => layerSelection.subscribe(notify), [layerSelection]);
  const layerSelectionSnapshot = useSyncExternalStore(subscribeToLayerSelection, () => layerSelection.snapshot());
  const selectableReader = useMemo(() => new SelectableShotLayerReader(services.layerAssets), [services]);
  const selectable = useMemo(() => selectableReader.read(partition, media), [selectableReader, partition, media]);
  // What is picked is always what is there: an undo, a removal or a deleted file takes it out.
  useEffect(() => layerSelection.retain(selectable), [layerSelection, selectable]);
  const isPickingLayers = layerSelectionSnapshot.isActive;
  const picked = useMemo(
    () => (layerSelectionSnapshot.isActive ? layerSelection.selectedIn(selectable) : []),
    [layerSelection, layerSelectionSnapshot, selectable],
  );
  const selectOptions = useMemo(
    () => SELECT_MENU.optionsFor(selectable, layerSelectionSnapshot.selectedLayerIds),
    [selectable, layerSelectionSnapshot],
  );
  const startPickingLayers = useCallback(() => {
    setOpenShot(null);
    setOpenWord(null);
    layerSelection.enter();
  }, [layerSelection]);
  const pickLayer = useCallback(
    (layerId: string, extendRange: boolean) => layerSelection.press(layerId, extendRange, selectable),
    [layerSelection, selectable],
  );

  const [parentRef, scrollEl] = useScrollParent();
  const virtualizer = useVirtualizer({
    count: resolved.length,
    getScrollElement: () => scrollEl,
    // Measured on mount; the estimate only sizes the scrollbar until then.
    estimateSize: () => 120,
    overscan: 4,
    getItemKey: (index) => resolved[index]!.id,
  });
  // Read before the scroll hook: a popover whose shot is gone renders
  // nothing, and must not keep the list held.
  const shotPopoverNode = openShot ? shotPopover(openShot) : null;
  const wordPopoverNode = openWord ? wordPopover(openWord) : null;
  const shotIds = useMemo(() => resolved.map((shot) => shot.id), [resolved]);
  useVirtualListAutoScroll({
    virtualizer, scrollReady: !!scrollEl, itemIds: shotIds, activeId: activeShotId, isPlaying,
    // A popover is anchored where it was opened: moving the list under it
    // would leave it pointing at a different shot.
    scrollRequest, holdStill: shotPopoverNode !== null || wordPopoverNode !== null, isVisible,
  });

  // Brings the shot on screen from its start, unless it is already playing: going back to its start
  // would restart it under every click on its card, its menu or the menu's items.
  const select = useCallback((shot: ResolvedShot) => {
    if (isPlaying && shot.id === activeShotId) return;
    playback.seek(shot.startSec);
  }, [playback, isPlaying, activeShotId]);
  // The popover opened at the shot's start, but the video may have played on since: back to the shot, so
  // the layer being edited is the one on screen.
  const editLayer = useCallback((shotStartSec: number, layerId: string) => {
    overlaySelection.pickShotLayer(layerId);
    playback.seek(shotStartSec);
  }, [playback, overlaySelection]);
  const shotPlayback = useShotPlayback();
  const playShot = useCallback(
    (shot: ResolvedShot) => shotPlayback.playShot(shot.startSec, shot.endSec),
    [shotPlayback],
  );

  const openSettings = useCallback(
    (shot: ResolvedShot, point: { x: number; y: number }, screen: ShotSettingsScreen, layerId?: string) => {
      select(shot);
      setOpenShot({ shotId: shot.id, point, screen, layerId: layerId ?? null, pressedShotId: shot.id });
    },
    [select],
  );
  // A layer still showing on a later shot is asked about there, and answered by the shot that holds it: the
  // playhead goes to the card pressed, where the layer is on screen, and the popover is its own shot's.
  const openContinuingLayer = useCallback(
    (shot: ResolvedShot, point: { x: number; y: number }, screen: ShotSettingsScreen, layerId: string) => {
      const holder = partition.shotHolding(layerId);
      if (holder === null) return;
      select(shot);
      setOpenShot({ shotId: holder.id, point, screen, layerId, pressedShotId: shot.id });
    },
    [select, partition],
  );
  // A layer over the whole video is asked about above the shots: the first shot holds it, and no card was pressed.
  const openWholeVideoLayer = useCallback((layerId: string, screen: ShotSettingsScreen, point: { x: number; y: number }) => {
    const holder = partition.shotHolding(layerId);
    if (holder !== null) setOpenShot({ shotId: holder.id, point, screen, layerId, pressedShotId: '' });
  }, [partition]);
  // A shot is inspected as a whole in the element inspector, on the page asked for, the playhead taken to it so
  // its camera is on screen.
  const openShotInspector = useCallback((shot: ResolvedShot, page: 'camera' | 'sound') => {
    select(shot);
    setOpenShot(null);
    workspace.requestInspectorPage(page);
    overlaySelection.pickShot(shot.id);
  }, [select, overlaySelection, workspace]);
  // A camera still running over a later shot is asked about there, and answered by the shot it belongs to.
  const openContinuingCamera = useCallback((shot: ResolvedShot, point: { x: number; y: number }) => {
    const owner = partition.videoShotOf(shot.id);
    if (owner === null) return;
    select(shot);
    setOpenShot({ shotId: owner.id, point, screen: 'camera', layerId: null, pressedShotId: shot.id });
  }, [select, partition]);
  const openWordAt = useCallback(
    (shot: ResolvedShot, pieceIndex: number, point: { x: number; y: number }) => {
      playback.seek(shot.pieces[pieceIndex]?.startSec ?? shot.startSec);
      setOpenWord({ shotId: shot.id, pieceIndex, point });
    },
    [playback],
  );

  // A video shows as the shot's b-roll, a picture or a GIF on top of it: the type decides which.
  // Showing only ever rejects with its own failure, which carries its copy.
  const showFile = useCallback((shotId: string, mediaId: string, origin: ShotFileOrigin) => {
    actions.showFile.execute(shotId, mediaId, origin).catch((error: unknown) => appNoticeChannel.publish(error as AppError));
  }, [actions, appNoticeChannel]);

  // A new file is shown as soon as it is kept: the shot takes it while its proxy is made.
  const uploadFile = useCallback((shotId: string, file: File, accepted: readonly MediaAssetType[]) => {
    mediaModule.actions.import.execute(file, 'project', 'shot-upload', accepted).then(
      (added) => showFile(shotId, added.id, 'shot-upload'),
      // The import only ever rejects with its own failure, which carries its copy.
      (error: unknown) => appNoticeChannel.publish(error as AppError),
    );
  }, [mediaModule, showFile, appNoticeChannel]);
  const retryFile = useRetryMediaAsset();
  // Seeking there too puts the result on screen at once.
  const dropFile = useCallback((shot: ResolvedShot, mediaId: string) => {
    showFile(shot.id, mediaId, 'bin-drop');
    select(shot);
  }, [showFile, select]);

  // A new length or a recalculation throws edits away, so it asks first when there are any.
  const repropose = (maxShotSec: number) => {
    if (shots.isEmpty()) actions.repropose.execute(maxShotSec);
    else setPendingMaxShotSec(maxShotSec);
  };

  return (
    <EditorTab title="Shots" hideTitleRow>
      {resolved.length === 0 ? (
        <p className={EMPTY_CLASS}>No shots yet. They appear once the video has been transcribed.</p>
      ) : (
        <>
          {isPickingLayers ? (
            <ShotLayerSelectionHeader onClose={() => layerSelection.exit()} />
          ) : (
            // The buttons drop under the slider where the panel is too narrow for both.
            <div className="pb-2.5 mb-1 border-b border-edge-subtle flex flex-wrap items-center gap-x-1 gap-y-1">
              <div className="grow basis-[176px] min-w-0">
                <Slider
                  label="Max length"
                  value={shots.maxShotSec}
                  min={2}
                  max={20}
                  step={0.5}
                  unit="s"
                  compact
                  onChange={repropose}
                />
              </div>
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <LocateButton
                  targetLabel="shot"
                  disabled={activeShotId === null}
                  onLocate={() => {
                    if (activeShotId !== null) setScrollRequest({ targetId: activeShotId, token: Date.now() });
                  }}
                />
                <ShotsActionsPopover
                  hasLayers={selectable.length > 0}
                  onSelectLayers={startPickingLayers}
                  canRecalculate={!shots.isEmpty()}
                  onRecalculate={() => repropose(shots.maxShotSec)}
                />
              </div>
            </div>
          )}
          {!isPickingLayers && (
            <ShotsWholeVideoRow
              layers={wholeVideoLayers}
              shotLengthsSec={shotLengths.list()}
              durationSec={shotLengths.totalSec()}
              onOpen={openWholeVideoLayer}
            />
          )}
          <div ref={parentRef} style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map(({ index, start }) => {
              const shot = resolved[index]!;
              return (
                <div
                  key={shot.id}
                  data-index={index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${start}px)` }}
                >
                  {index > 0 && <ShotSeam shotId={shot.id} atSec={shot.startSec} transition={shot.transition} projectId={projectId} />}
                  <ShotCard
                    shot={shot}
                    index={index}
                    isActive={shot.id === activeShotId}
                    isPlaying={isPlaying && shot.id === activeShotId}
                    openedScreen={openShot?.pressedShotId === shot.id ? openShot.screen : null}
                    canEditTiming={resolved.length > 1}
                    aspectRatio={videoAspectRatio}
                    posterSource={posterSource}
                    videoSampler={videoSampler}
                    brollSampler={brollSampler}
                    projectId={projectId}
                    onSelect={select}
                    onPlay={playShot}
                    onPause={playback.pause}
                    onOpenSettings={openSettings}
                    onOpenWord={openWordAt}
                    dragFormat={DRAG_FORMAT}
                    onDropFile={dropFile}
                    pickedLayerIds={isPickingLayers ? layerSelectionSnapshot.selectedLayerIds : null}
                    onPickLayer={pickLayer}
                    onOpenContinuingLayer={openContinuingLayer}
                    layerShotNumbers={layerShotNumbers}
                    wholeVideoLayerIds={wholeVideoLayerIds}
                    cameraLabel={cameraLabelOf(shot.id)}
                    continuingCamera={continuingCameraOf(shot.id)}
                    onOpenContinuingCamera={openContinuingCamera}
                    wordsWithSounds={wordsWithSounds}
                    soundsPresenter={soundsPresenter}
                  />
                </div>
              );
            })}
          </div>
          {isPickingLayers && (
            <ShotLayerSelectionBar
              countLabel={LABELS.countOf(picked.map((layer) => layer.kind))}
              selectionCount={picked.length}
              selectOptions={selectOptions}
              onSelect={(layerIds) => layerSelection.selectOnly(layerIds, selectable)}
              onEditTogether={() => overlaySelection.pickShotLayers(picked.map((layer) => layer.layerId))}
              onRemove={() => actions.removeLayers.execute(picked.map((layer) => layer.layerId), 'selection')}
              onDone={() => layerSelection.exit()}
            />
          )}
        </>
      )}
      {shotPopoverNode}
      {wordPopoverNode}
      <ConfirmDialog
        open={pendingMaxShotSec !== null}
        message={REPROPOSE_WARNING}
        confirmLabel="Replace"
        danger
        onConfirm={() => {
          if (pendingMaxShotSec !== null) actions.repropose.execute(pendingMaxShotSec);
          setPendingMaxShotSec(null);
        }}
        onCancel={() => setPendingMaxShotSec(null)}
      />
    </EditorTab>
  );

  function shotPopover({ shotId, point, screen, layerId }: OpenShotPopover) {
    const index = resolved.findIndex((shot) => shot.id === shotId);
    const shot = resolved[index];
    if (!shot) return null;
    const previous = resolved[index - 1];
    const next = resolved[index + 1];
    const ownBroll = services.layerAssets.videoLayerOf(shot.layers, media);
    // The b-roll screen is about the shot's b-roll, or the video layer it was opened from.
    const broll = shot.layers.find((layer): layer is ShotFileLayer => layer.id === layerId && 'mediaId' in layer && services.layerAssets.isVideo(layer.mediaId, media)) ?? ownBroll;
    const picture = services.layerAssets.pictureLayersOf(shot.layers, media).find(({ layer }) => layer.id === layerId) ?? null;
    const missing = services.layerAssets.missingLayersOf(shot.layers, media).find((layer) => layer.id === layerId) ?? null;
    const graphicLayer = shot.layers.find((layer) => layer.id === layerId && 'graphic' in layer) ?? null;
    const graphic = graphicLayer !== null && 'graphic' in graphicLayer ? graphicLayer : null;
    return (
      <ShotSettingsPopover
        key={`${shotId}:${screen}:${layerId ?? ''}`}
        open
        initialScreen={screen}
        onOpenChange={(isOpen) => { if (!isOpen) setOpenShot(null); }}
        point={point}
        startSec={shot.startSec}
        endSec={shot.endSec}
        previousStartSec={previous?.startSec ?? null}
        nextEndSec={next?.endSec ?? null}
        onJoinWithPrevious={previous ? () => actions.join.execute(shot.id) : null}
        onJoinWithNext={next ? () => actions.join.execute(next.id) : null}
        onMoveStart={previous ? (sec) => actions.moveStart.execute(shot.id, sec) : null}
        onMoveEnd={next ? (sec) => actions.moveStart.execute(next.id, sec) : null}
        brollMediaId={broll?.mediaId ?? null}
        broll={broll ? media.get(broll.mediaId) : null}
        library={media.list().filter((asset) => asset.type === 'video')}
        onUploadBroll={(file) => uploadFile(shot.id, file, VIDEO_FILE_TYPES)}
        onPickBroll={(mediaId) => showFile(shot.id, mediaId, 'shot-picker')}
        onRemoveBroll={() => { if (broll) actions.removeLayers.execute([broll.id], 'popover'); }}
        onRetryBroll={() => { if (broll) retryFile(broll.mediaId); }}
        brollPlacement={broll ? partition.placementOf(broll.id) : null}
        picture={picture && {
          mediaId: picture.layer.mediaId,
          kind: picture.kind,
          asset: media.get(picture.layer.mediaId),
          placement: partition.placementOf(picture.layer.id),
        }}
        pictureLibrary={media.list().filter((asset) => PICTURE_FILE_TYPES.includes(asset.type))}
        onUploadPicture={(file) => uploadFile(shot.id, file, PICTURE_FILE_TYPES)}
        onPickPicture={(mediaId) => showFile(shot.id, mediaId, 'shot-picker')}
        onRemovePicture={() => { if (picture) actions.removeLayers.execute([picture.layer.id], 'popover'); }}
        onRetryPicture={() => { if (picture) retryFile(picture.layer.mediaId); }}
        missingMediaId={missing?.mediaId ?? null}
        onRemoveMissing={() => { if (missing) actions.removeLayers.execute([missing.id], 'popover'); }}
        onEditPicture={() => { if (picture) editLayer(shot.startSec, picture.layer.id); }}
        onEditBroll={() => { if (broll) editLayer(shot.startSec, broll.id); }}
        onAddGraphic={() => {
          const opening = partition.list()[0]?.id === shot.id;
          const starter = opening ? services.graphicPresets.openingStarter() : services.graphicPresets.starter();
          const layerId = actions.addGraphic.execute(shot.id, starter);
          if (layerId !== null) editLayer(shot.startSec, layerId);
        }}
        graphic={graphic && {
          name: services.graphicPresets.presetOf(graphic.graphic)?.name ?? 'Custom',
          placement: partition.placementOf(graphic.id),
        }}
        onEditGraphic={() => { if (graphic) editLayer(shot.startSec, graphic.id); }}
        onRemoveGraphic={() => { if (graphic) actions.removeLayers.execute([graphic.id], 'popover'); }}
        onOpenCamera={() => openShotInspector(shot, 'camera')}
        onOpenSounds={() => openShotInspector(shot, 'sound')}
        soundCount={audioTab.shotEffectRows(audioMix, audioContext, shot).length}
        onCut={() => cuts.actions.add.execute({ startSec: shot.startSec, endSec: shot.endSec })}
        duration={screen === 'camera'
          ? cameraDurationOf(shot.id)
          : layerDurationOf(broll !== null && (layerId === null || layerId === broll.id) ? broll.id : layerId)}
        cameraLabel={cameraLabelOf(shot.id)}
        onRemoveCamera={() => actions.setCamera.pick({ kind: 'shot', shotId: shot.id }, null)}
        projectId={projectId}
      />
    );
  }

  /**
   * How long the layer `layerId` shows, and each shot it could end with, its own first; null for no layer. A run
   * from the first shot through the last is offered as the whole video only, not again as the last shot.
   */
  function layerDurationOf(layerId: string | null): ShotLayerDurationData | null {
    if (layerId === null) return null;
    const run = partition.runOf(layerId);
    const own = run[0];
    if (own === undefined) return null;
    const from = resolved.findIndex((shot) => shot.id === own.id);
    const offersWholeVideo = resolved.length > 1;
    const reachable = resolved.slice(from, offersWholeVideo && from === 0 ? -1 : undefined);
    return {
      shotLengthsSec: shotLengths.list(),
      wholeVideo: offersWholeVideo
        ? {
          picked: partition.showsOverWholeVideo(layerId),
          durationSec: shotLengths.totalSec(),
          onPick: () => actions.setLayerThrough.overWholeVideo(layerId),
        }
        : null,
      choices: durationChoicesOf(from, reachable, run[run.length - 1]!.id, (shotId) => actions.setLayerThrough.execute(layerId, shotId)),
    };
  }

  /**
   * How long the camera of the shot `shotId` runs, and each shot it could end with, its own first: as far as the
   * shot before the next one whose video has a style of its own, which always draws itself.
   */
  function cameraDurationOf(shotId: string): ShotLayerDurationData | null {
    const run = partition.videoRunOf(shotId);
    const last = run[run.length - 1];
    if (last === undefined) return null;
    const from = resolved.findIndex((shot) => shot.id === shotId);
    const following = resolved.slice(from + 1);
    const taken = following.findIndex((shot) => partition.layerStyles.get(ShotVideoLayerId.of(shot.id)) !== null);
    const reachable = [resolved[from]!, ...(taken === -1 ? following : following.slice(0, taken))];
    return {
      shotLengthsSec: shotLengths.list(),
      wholeVideo: null,
      choices: durationChoicesOf(from, reachable, last.id, (throughShotId) => actions.setVideoThrough.execute(shotId, throughShotId)),
    };
  }

  /** Each shot of `reachable`, the first being the one at `from`, as a shot something opening there can end with. */
  function durationChoicesOf(
    from: number,
    reachable: ReadonlyArray<ResolvedShot>,
    lastShotId: string,
    endWith: (shotId: string) => void,
  ): ShotLayerDurationData['choices'] {
    return reachable.map((shot, offset) => ({
      shotNumber: from + offset + 1,
      text: shot.pieces.map((piece) => piece.text).join(' '),
      durationSec: shotLengths.runSec(from, from + offset),
      picked: shot.id === lastShotId,
      onPick: () => endWith(shot.id),
    }));
  }

  function wordPopover({ shotId, pieceIndex, point }: OpenWordPopover) {
    const index = resolved.findIndex((shot) => shot.id === shotId);
    const shot = resolved[index];
    const piece = shot?.pieces[pieceIndex];
    if (!shot || !piece) return null;
    const previous = resolved[index - 1];
    const next = resolved[index + 1];
    const followingPiece = shot.pieces[pieceIndex + 1];
    const isFirst = pieceIndex === 0;
    const isLast = pieceIndex === shot.pieces.length - 1;
    return (
      <ShotWordPopover
        open
        onOpenChange={(isOpen) => { if (!isOpen) setOpenWord(null); }}
        point={point}
        soundAnchor={soundsPresenter.wordAnchor(piece.wordId)}
        projectId={projectId}
        onSplit={isFirst ? null : () => actions.splitBeforeWord.execute(piece.wordId)}
        onMoveToPreviousShot={isFirst && previous && followingPiece
          ? () => actions.moveStartToWord.execute(shot.id, followingPiece.wordId)
          : null}
        // A word the shot opens on cannot leave without taking the whole shot with it.
        onMoveToNextShot={isLast && next && piece.startSec > shot.startSec
          ? () => actions.moveStartToWord.execute(next.id, piece.wordId)
          : null}
      />
    );
  }
});

