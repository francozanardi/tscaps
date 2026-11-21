import { useCallback, useMemo } from 'react';
import { ArrowLeft, Blend, Code2, LayoutTemplate, LibraryBig, Orbit, Palette, Video, Volume2 } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { InspectedElementHeader } from '@ui/pages/editor/features/element/InspectedElementHeader';
import { ElementMotionPanel } from '@ui/pages/editor/features/element/ElementMotionPanel';
import { ElementStylePanel } from '@ui/pages/editor/features/element/ElementStylePanel';
import { ElementPositionPanel } from '@ui/pages/editor/features/element/ElementPositionPanel';
import { WordSoundPanel } from '@ui/pages/editor/features/audio/components/WordSoundPanel';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { ElementInspectorTabs } from '@ui/pages/editor/features/element/ElementInspectorTabs';
import { ElementEffectsPanel } from '@ui/pages/editor/features/element/ElementEffectsPanel';
import { ElementCodePanel } from '@ui/pages/editor/features/element/ElementCodePanel';
import { useIsInspectedElementOffScreen } from '@ui/pages/editor/features/element/useIsInspectedElementOffScreen';
import { useInspectedElementPlay } from '@ui/pages/editor/features/element/useInspectedElementPlay';
import { useInspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';
import { ShotCameraPanel } from '@ui/pages/editor/features/shots/camera/ShotCameraPanel';
import { ShotLayerCameraPanel } from '@ui/pages/editor/features/shots/camera/ShotLayerCameraPanel';
import { ShotSoundPanel } from '@ui/pages/editor/features/shots/components/ShotSoundPanel';
import { ShotLayerFileActions } from '@ui/pages/editor/features/shots/components/ShotLayerFileActions';
import { ShotLayerGroupActions } from '@ui/pages/editor/features/shots/components/ShotLayerGroupActions';
import { ShotLayerGroupLayoutPanel } from '@ui/pages/editor/features/shots/components/ShotLayerGroupLayoutPanel';
import { ShotLayerStackedThumbnails } from '@ui/pages/editor/features/shots/components/ShotLayerStackedThumbnails';
import { ShotLayerLayoutPanel } from '@ui/pages/editor/features/shots/components/ShotLayerLayoutPanel';
import { GraphicCodePanel } from '@ui/pages/editor/features/graphics/components/GraphicCodePanel';
import { GraphicPresetsPanel } from '@ui/pages/editor/features/graphics/components/GraphicPresetsPanel';
import { ShotLayerMotionPanel, type ShotLayerMotionTarget } from '@ui/pages/editor/features/shots/components/ShotLayerMotionPanel';
import { ShotLayerSoundPanel } from '@ui/pages/editor/features/shots/components/ShotLayerSoundPanel';
import { ShotLayerThumbnail } from '@ui/pages/editor/features/shots/components/ShotLayerThumbnail';
import { ShotThumbnail } from '@ui/pages/editor/features/shots/components/ShotThumbnail';
import { CaptionElementThumbnail } from '@ui/pages/editor/features/element/CaptionElementThumbnail';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { useShotLayerCssWrite } from '@ui/pages/editor/features/shots/hooks/useShotLayerCssWrite';
import { useSceneReplay } from '@ui/pages/editor/hooks/useSceneReplay';
import { useIsElementInspectorOpen } from '@ui/pages/editor/hooks/useIsElementInspectorOpen';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface ElementInspectorProps {
  document: Document | null;
  shots: ShotPartition;
  selectionController: OverlaySelectionController;
}

const HEADER_CLASS =
  'shrink-0 flex items-center gap-2 p-2 bg-surface-1 border border-edge-subtle rounded-md';

const CARD_CLASS =
  'flex flex-col flex-1 min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';

const TAB_ICON_SIZE = 22;

const BACK_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-muted cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-primary hover:bg-surface-2 '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * Everything that can be said about the element picked in the preview:
 * for a caption element, how it looks, how it moves, and the CSS the
 * first two are a view of; for a graphic, its fields and the presets
 * it can start over from, its box, how it comes in and leaves, its sounds and its
 * code; for any other shot layer, its file, where it sits,
 * which stretch of the file it plays, how it comes in and leaves and
 * what its camera does with its picture inside its box; for several shot layers picked together, what they share, set on all
 * of them at once; for a shot, what its camera does with its video and
 * every sound that belongs to it.
 *
 * It stands in front of the whole workspace pane rather than beside its
 * modes. The elements it edits are not a part of the project the way
 * captions are — they are whatever the user just pointed at, an emoji
 * today, a GIF or a widget later — so it is opened from the pick and
 * left through the same door, and the mode underneath is exactly where
 * it was.
 *
 * Renders as two siblings, the header and the card, so it occupies the
 * pane's own rows and needs no surface of its own.
 *
 * It is open only while the element is painted, so the state it draws
 * for a missing one covers the narrow case of a scene outliving what
 * was picked inside it: an edit took the element out and the pick still
 * stands.
 */
export function ElementInspector({ document, shots, selectionController }: ElementInspectorProps) {
  const isOpen = useIsElementInspectorOpen();
  const element = useInspectedElement(selectionController, document, shots);
  const offScreen = useIsInspectedElementOffScreen(element, selectionController);
  const play = useInspectedElementPlay(element);
  const caption = element !== null && element.kind !== 'shot-layer' && element.kind !== 'shot-layers' && element.kind !== 'shot'
    ? element
    : null;
  const { elementStyles, sheets, activeCaptionTrackId } = useEditorState();
  const soundsPresenter = useAnchoredSoundsPresenter();
  const replayWithinScene = useSceneReplay(caption?.sceneEndsAt ?? 0);

  const sheet = useMemo(
    () => sheets.find((candidate) => candidate.id === caption?.sheetId) ?? null,
    [sheets, caption?.sheetId],
  );
  const elements = useElements();
  const shotActions = useShots().actions;
  // Every element but several layers edited together has one set of defaults to go back to.
  const reset = caption
    ? { enabled: elements.actions.reset.holdsAnything(caption.id), onReset: () => elements.actions.reset.execute(caption.id) }
    : element?.kind === 'shot-layer'
      ? { enabled: true, onReset: () => shotActions.reset.resetLayer(element.id) }
      : element?.kind === 'shot'
        ? { enabled: true, onReset: () => shotActions.reset.resetShot(element.shotId) }
        : null;
  // Closing is letting the element go: there is no picked-but-closed state to come back to.
  const close = useCallback(() => selectionController.clearSelection(), [selectionController]);
  const layerCssWrite = useShotLayerCssWrite();
  const groupMotionTargets = useMemo<ReadonlyArray<ShotLayerMotionTarget>>(
    () => (element?.kind === 'shot-layers'
      ? element.layers.flatMap((entry) => (entry.kind !== null ? [{ layer: entry.layer }] : []))
      : []),
    [element],
  );

  if (!isOpen) return null;

  return (
    <>
      <div className={HEADER_CLASS}>
        <Tooltip text="Back to the panel">
          <button type="button" onClick={close} aria-label="Back to the panel" className={BACK_BUTTON_CLASS}>
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        </Tooltip>
        {element ? (
          <InspectedElementHeader
            element={element}
            thumbnail={element.kind === 'shot-layer'
              ? <ShotLayerThumbnail media={element.media} isGraphic={'graphic' in element.layer} />
              : element.kind === 'shot-layers'
                ? <ShotLayerStackedThumbnails media={element.layers.map((entry) => entry.media)} />
                : element.kind === 'shot'
                  ? <ShotThumbnail startSec={element.startSec} />
                  : <CaptionElementThumbnail element={element} />}
            actions={element.kind === 'shot-layer'
              ? <ShotLayerFileActions element={element} />
              : element.kind === 'shot-layers'
                ? <ShotLayerGroupActions group={element} />
                : undefined}
            reset={reset}
            play={play}
            offScreen={offScreen}
          />
        ) : (
          <span className="text-sm text-fg-muted truncate">Nothing to edit</span>
        )}
      </div>

      <div className={CARD_CLASS}>
        {element?.kind === 'shot-layers' ? (
          <ElementInspectorTabs
            elementKind="shot-layers"
            tabs={[
              {
                value: 'layout',
                label: 'Layout',
                icon: <LayoutTemplate size={TAB_ICON_SIZE} />,
                content: <ShotLayerGroupLayoutPanel group={element} />,
              },
              // Layers whose file is gone draw nothing, so only the rest have motion, or edges to sound at.
              ...(groupMotionTargets.length === 0 ? [] : [{
                value: 'motion',
                label: 'Motion',
                icon: <Orbit size={TAB_ICON_SIZE} />,
                content: <ShotLayerMotionPanel targets={groupMotionTargets} />,
              }, {
                value: 'sound',
                label: 'Sound',
                icon: <Volume2 size={TAB_ICON_SIZE} />,
                content: <ShotLayerSoundPanel layerIds={groupMotionTargets.map((target) => target.layer.id)} />,
              }]),
            ]}
          />
        ) : element?.kind === 'shot' ? (
          <ElementInspectorTabs
            elementKind="shot"
            tabs={[{
              value: 'camera',
              label: 'Camera',
              icon: <Video size={TAB_ICON_SIZE} />,
              content: <ShotCameraPanel shotId={element.shotId} startSec={element.startSec} endSec={element.videoEndSec} />,
            }, {
              value: 'sound',
              label: 'Sound',
              icon: <Volume2 size={TAB_ICON_SIZE} />,
              content: <ShotSoundPanel shotId={element.shotId} />,
            }, {
              value: 'code',
              label: 'Code',
              icon: <Code2 size={TAB_ICON_SIZE} />,
              content: (
                <ElementCodePanel
                  elementId={ShotVideoLayerId.of(element.shotId)}
                  kind="layer"
                  fragment={shots.layerStyles.get(ShotVideoLayerId.of(element.shotId))}
                  cssWrite={layerCssWrite}
                  isShotVideo
                />
              ),
            }]}
          />
        ) : element?.kind === 'shot-layer' && 'graphic' in element.layer ? (
          <ElementInspectorTabs
            elementKind="graphic"
            tabs={[
              {
                value: 'presets',
                label: 'Presets',
                icon: <LibraryBig size={TAB_ICON_SIZE} />,
                content: <GraphicPresetsPanel layer={element.layer} opening={shots.shotHolding(element.layer.id)?.id === shots.list()[0]?.id} />,
              },
              {
                value: 'layout',
                label: 'Layout',
                icon: <LayoutTemplate size={TAB_ICON_SIZE} />,
                content: <ShotLayerLayoutPanel element={element} />,
              },
              {
                value: 'motion',
                label: 'Motion',
                icon: <Orbit size={TAB_ICON_SIZE} />,
                content: <ShotLayerMotionPanel targets={[{ layer: element.layer }]} />,
              },
              {
                value: 'sound',
                label: 'Sound',
                icon: <Volume2 size={TAB_ICON_SIZE} />,
                content: <ShotLayerSoundPanel layerIds={[element.layer.id]} />,
              },
              {
                value: 'code',
                label: 'Code',
                icon: <Code2 size={TAB_ICON_SIZE} />,
                content: <GraphicCodePanel layer={element.layer} boxStyle={shots.layerStyles.get(element.layer.id)} />,
              },
            ]}
          />
        ) : element?.kind === 'shot-layer' ? (
          <ElementInspectorTabs
            elementKind="shot-layer"
            tabs={[
              {
                value: 'layout',
                label: 'Layout',
                icon: <LayoutTemplate size={TAB_ICON_SIZE} />,
                content: <ShotLayerLayoutPanel element={element} />,
              },
              // A layer whose file is gone draws nothing, so it has no motion to give, nor edges to sound at.
              ...(element.media === null ? [] : [{
                value: 'motion',
                label: 'Motion',
                icon: <Orbit size={TAB_ICON_SIZE} />,
                content: <ShotLayerMotionPanel targets={[{ layer: element.layer }]} />,
              }, {
                value: 'camera',
                label: 'Camera',
                icon: <Video size={TAB_ICON_SIZE} />,
                content: <ShotLayerCameraPanel layerId={element.layer.id} media={element.media} />,
              }, {
                value: 'sound',
                label: 'Sound',
                icon: <Volume2 size={TAB_ICON_SIZE} />,
                content: <ShotLayerSoundPanel layerIds={[element.layer.id]} />,
              }]),
              {
                value: 'code',
                label: 'Code',
                icon: <Code2 size={TAB_ICON_SIZE} />,
                content: (
                  <ElementCodePanel
                    elementId={element.layer.id}
                    kind="layer"
                    fragment={shots.layerStyles.get(element.layer.id)}
                    cssWrite={layerCssWrite}
                  />
                ),
              },
            ]}
          />
        ) : caption ? (
          <ElementInspectorTabs
            elementKind={caption.kind}
            tabs={[
              {
                value: 'style',
                label: 'Style',
                icon: <Palette size={TAB_ICON_SIZE} />,
                content: (
                  <>
                    <ElementStylePanel
                      elementId={caption.id}
                      kind={caption.kind}
                      sheet={sheet}
                      ancestorIds={caption.ancestorIds}
                    />
                    {sheet && (
                      <ElementPositionPanel
                        elementId={caption.id}
                        kind={caption.kind}
                        sheet={sheet}
                        ancestorIds={caption.ancestorIds}
                      />
                    )}
                  </>
                ),
              },
              {
                value: 'motion',
                label: 'Motion',
                icon: <Orbit size={TAB_ICON_SIZE} />,
                content: (
                  <ElementMotionPanel
                    elementId={caption.id}
                    kind={caption.kind}
                    animationSupport={sheet?.template.features.animation ?? null}
                    style={elementStyles.get(caption.id)}
                    startsAt={caption.startsAt}
                    endsAt={caption.endsAt}
                    leavesAt={caption.sceneEndsAt}
                    onReplay={replayWithinScene}
                  />
                ),
              },
              {
                value: 'effects',
                label: 'Effects',
                icon: <Blend size={TAB_ICON_SIZE} />,
                content: (
                  <ElementEffectsPanel
                    elementId={caption.id}
                    kind={caption.kind}
                    ancestorIds={caption.ancestorIds}
                    scene={caption.scene}
                    sheet={sheet}
                  />
                ),
              },
              // A sound is placed on a word of what is said, never of a translation.
              ...(caption.kind === 'word' && soundsPresenter.offersSoundsOnTranscriptWords(activeCaptionTrackId) ? [{
                value: 'sound',
                label: 'Sound',
                icon: <Volume2 size={TAB_ICON_SIZE} />,
                content: <WordSoundPanel wordId={caption.id} />,
              }] : []),
              {
                value: 'code',
                label: 'Code',
                icon: <Code2 size={TAB_ICON_SIZE} />,
                content: (
                  <ElementCodePanel
                    elementId={caption.id}
                    kind={caption.kind}
                    fragment={elementStyles.get(caption.id)}
                  />
                ),
              },
            ]}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="m-0 text-md text-fg-secondary">This element is gone.</p>
            <p className="m-0 text-sm text-fg-muted max-w-[32ch]">
              An edit took it out of the video. Pick another one in the preview.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
