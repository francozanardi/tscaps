import '@ui/pages/editor/features/overlay/components/SubtitleOverlay.css';
import { memo, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { CaptionStacking, Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';
import type { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { ActiveSegmentLayer } from '@ui/pages/editor/features/overlay/components/segments/ActiveSegmentLayer';
import { PersistentVideoFrameProvider } from '@ui/pages/editor/features/overlay/components/video-frame/PersistentVideoFrameProvider';
import { SubtitleOverlayPopovers } from '@ui/pages/editor/features/overlay/components/SubtitleOverlayPopovers';
import { SnapGuides } from '@ui/pages/editor/features/overlay/components/SnapGuides';
import { SegmentScopeChip } from '@ui/pages/editor/features/overlay/components/segments/SegmentScopeChip';
import { SegmentSelectionChrome } from '@ui/pages/editor/features/overlay/components/segments/SegmentSelectionChrome';
import { SegmentDropTargetChrome } from '@ui/pages/editor/features/overlay/components/segments/SegmentDropTargetChrome';
import { SegmentHitzone } from '@ui/pages/editor/features/overlay/components/segments/SegmentHitzone';
import { WordSelectionRing } from '@ui/pages/editor/features/overlay/components/words/WordSelectionRing';
import { WordResizeHandles } from '@ui/pages/editor/features/overlay/components/words/WordResizeHandles';
import { WordRotateHandle } from '@ui/pages/editor/features/overlay/components/words/WordRotateHandle';
import { useBehindActorActivation } from '@ui/pages/editor/features/overlay/hooks/useBehindActorActivation';
import { useSegmentSelection } from '@ui/pages/editor/features/overlay/hooks/useSegmentSelection';
import { useSheetArtifacts } from '@ui/pages/editor/features/overlay/hooks/useSheetArtifacts';
import { OverlayControllerProvider } from '@ui/pages/editor/features/overlay/contexts/OverlayControllerContext';
import { OverlayGeometryProvider } from '@ui/pages/editor/features/overlay/contexts/OverlayGeometryContext';
import { OverlayManipulationProvider } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useBoundSheetFilterDefs } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useActiveSegments } from '@ui/_shared/contexts/EditorStoreContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

interface SubtitleOverlayProps {
  overlayController: SubtitleOverlayController;
  manipulationController: OverlayManipulationController;
  selectionController: OverlaySelectionController;
  document: Document;
  sheets: Sheet[];
  behindActorOverrides: BehindActorOverrideRegistry;
  elementStyles: ElementStyles;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  /** Extra content rendered inside the video coordinate space, above subtitles. */
  videoOverlay?: ReactNode;
  /**
   * Content that occludes the caption layers — the preview counterpart
   * of the export pipeline's top layer. Rendered above subtitles and
   * `videoOverlay` but below the editing chrome, so selection strokes
   * and handles stay visible through it.
   */
  occlusionOverlay?: ReactNode;
}

// Scaler fills the displayed video region; `container-type: size` (in
// CSS) makes it the resolution target for `cqh` / `cqw` inside the
// subtree, so templates express font-size proportional to the video
// without any JS multiplier. Positioning is percentage-based, also
// relative to this box, so nothing here depends on the video's
// intrinsic pixel dimensions.
const SCALER_STYLE: CSSProperties = { width: '100%', height: '100%' };
const HIDDEN_SVG_STYLE: CSSProperties = { position: 'absolute' };

export const SubtitleOverlay = memo(function SubtitleOverlay({
  overlayController,
  manipulationController,
  selectionController,
  document: doc,
  sheets,
  behindActorOverrides,
  elementStyles,
  decorationOverrides,
  videoDuration,
  videoOverlay,
  occlusionOverlay,
}: SubtitleOverlayProps) {
  const { constants } = useEngine();
  // Mobile is read-only: no selection, no popovers, no handlers.
  const isMobile = useIsMobileViewport();
  const activeSegments = useActiveSegments(doc);
  const { cssBySheet, wrapperVarsBySheet, segmentPositions, sheetBySegmentId, activeSegmentIds } =
    useSheetArtifacts(doc, sheets, activeSegments, elementStyles);
  const { paintedSelection, popover, setSelection, closePopover, onClick, onContextMenu } =
    useSegmentSelection(activeSegmentIds, selectionController);
  const behindActorActivation = useBehindActorActivation(doc, sheets, behindActorOverrides);
  const behindActorActiveSegmentIds = behindActorActivation.segmentIds;

  const selectedSegmentId = paintedSelection?.segmentId ?? null;
  const selectedSheet = selectedSegmentId !== null ? sheetBySegmentId.get(selectedSegmentId) : undefined;

  // The scaler box IS the `cqh`/`em` resolution target (see CSS), so its
  // px height is the factor the controller needs to resolve SVG filter
  // lengths. Push it on mount and on every resize. The same element is
  // the frame against which drag gestures measure cursor fractions.
  //
  // Held in state rather than only in a ref: chrome mounted in the same
  // commit measures against it, and React attaches a parent's ref after
  // its children's layout effects have already run.
  const [scaler, setScaler] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!scaler) return;
    manipulationController.setScaler(scaler);
    const pushHeight = () => overlayController.setRenderHeight(scaler.clientHeight);
    pushHeight();
    const observer = new ResizeObserver(pushHeight);
    observer.observe(scaler);
    return () => {
      observer.disconnect();
      manipulationController.setScaler(null);
    };
  }, [scaler, overlayController, manipulationController]);


  // Every active segment is laid out once per side of the actor cutout;
  // each mounts only the subtrees stacked on its side.
  const renderSegmentsIn = (stacking: CaptionStacking) => activeSegments.map((segment) => {
    const sheet = sheetBySegmentId.get(segment.id);
    if (!sheet) return null;
    const wrapperVars = wrapperVarsBySheet[sheet.id];
    if (!wrapperVars) return null;
    const segIdx = segmentPositions.positionOf(sheet.id, segment.id);
    return (
      <ActiveSegmentLayer
        key={segment.id}
        stacking={stacking}
        segment={segment}
        sheet={sheet}
        segIdx={segIdx}
        elementStyles={elementStyles}
        decorationOverrides={decorationOverrides}
        wrapperVars={wrapperVars}
        behindActorActive={behindActorActiveSegmentIds.has(segment.id)}
        elementsUnderTopLayer={behindActorActivation.elementIds}
      />
    );
  });

  return (
    <OverlayControllerProvider value={overlayController}>
      <OverlayManipulationProvider value={manipulationController}>
      <OverlayGeometryProvider
        document={doc}
        sheets={sheets}
        elementStyles={elementStyles}
        behindActorActiveSegmentIds={behindActorActiveSegmentIds}
      >
      <div className="subtitle-overlay-container">
        <div
          ref={setScaler}
          className="subtitle-overlay-scaler"
          style={SCALER_STYLE}
          onClick={isMobile ? undefined : onClick}
          onContextMenu={isMobile ? undefined : onContextMenu}
        >
          <PersistentVideoFrameProvider>
          {/* Same baseline the export prepends, composed by the same class. */}
          <style>{constants.CAPTION_BASELINE_CSS}</style>
          {sheets.map((sheet) => {
            const css = cssBySheet[sheet.id];
            return css ? <style key={sheet.id}>{css}</style> : null;
          })}
          {/* Filter ids are pre-scoped per sheet, so all sheets' defs
              can share one hidden SVG. width=0 keeps it out of layout
              — `url(#…)` resolves against the live document regardless. */}
          <svg width="0" height="0" style={HIDDEN_SVG_STYLE} aria-hidden>
            <defs>
              {sheets.map((sheet) => (
                <SheetFilterDefs key={sheet.id} sheet={sheet} />
              ))}
            </defs>
          </svg>
          {!isMobile && activeSegments.map((segment) => (
            sheetBySegmentId.has(segment.id)
              ? <SegmentHitzone key={segment.id} segmentId={segment.id} scaler={scaler} />
              : null
          ))}
          {renderSegmentsIn(constants.CAPTION_STACKING_UNDER_TOP_LAYER)}
          {videoOverlay}
          {occlusionOverlay}
          {/* Tree order is the occlusion: what mounts after the cutout is in front of the actor. */}
          {renderSegmentsIn(constants.CAPTION_STACKING_OVER_TOP_LAYER)}
          {!isMobile && <SnapGuides />}
          {!isMobile && <SegmentScopeChip selection={paintedSelection} />}
          {!isMobile && selectedSegmentId && selectedSheet && (
            <SegmentSelectionChrome
              segmentId={selectedSegmentId}
              sheet={selectedSheet}
              elementStyles={elementStyles}
              scaler={scaler}
              variant="selected"
            />
          )}
          {!isMobile && (
            <SegmentDropTargetChrome
              sheetBySegmentId={sheetBySegmentId}
              elementStyles={elementStyles}
              scaler={scaler}
            />
          )}
          {!isMobile && paintedSelection?.wordId && (
            <WordSelectionRing wordId={paintedSelection.wordId} scaler={scaler} />
          )}
          {!isMobile && paintedSelection?.wordId && (
            <WordResizeHandles wordId={paintedSelection.wordId} scaler={scaler} />
          )}
          {!isMobile && paintedSelection?.wordId && sheetBySegmentId.get(paintedSelection.segmentId)?.template.features.rotation.word && (
            <WordRotateHandle wordId={paintedSelection.wordId} scaler={scaler} />
          )}
          </PersistentVideoFrameProvider>
        </div>
        <SubtitleOverlayPopovers
          doc={doc}
          sheets={sheets}
          sheetBySegmentId={sheetBySegmentId}
          selection={paintedSelection}
          popover={popover}
          setSelection={setSelection}
          closePopover={closePopover}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
        />
      </div>
      </OverlayGeometryProvider>
      </OverlayManipulationProvider>
    </OverlayControllerProvider>
  );
});

const SheetFilterDefs = memo(function SheetFilterDefs({ sheet }: { sheet: Sheet }) {
  const ref = useBoundSheetFilterDefs(sheet);
  return <g ref={ref} />;
});
