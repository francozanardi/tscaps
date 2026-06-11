import '@ui/editor/components/overlay/SubtitleOverlay.css';
import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';
import type { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { ActiveSegmentLayer } from '@ui/editor/components/overlay/ActiveSegmentLayer';
import { PersistentVideoFrameProvider } from '@ui/editor/components/overlay/PersistentVideoFrameProvider';
import { SubtitleOverlayPopovers } from '@ui/editor/components/overlay/SubtitleOverlayPopovers';
import { SnapGuides } from '@ui/editor/components/overlay/SnapGuides';
import { SegmentScopeChip } from '@ui/editor/components/overlay/SegmentScopeChip';
import { WordSelectionRing } from '@ui/editor/components/overlay/WordSelectionRing';
import { WordResizeHandles } from '@ui/editor/components/overlay/WordResizeHandles';
import { WordRotateHandle } from '@ui/editor/components/overlay/WordRotateHandle';
import { useSegmentSelection } from '@ui/editor/components/overlay/useSegmentSelection';
import { useSheetArtifacts } from '@ui/editor/components/overlay/useSheetArtifacts';
import { OverlayControllerProvider } from '@ui/editor/components/overlay/OverlayControllerContext';
import { OverlayManipulationProvider } from '@ui/editor/components/overlay/OverlayManipulationContext';
import { useBoundSheetFilterDefs } from '@ui/editor/components/overlay/useOverlayBinding';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useActiveSegments } from '@ui/_shared/contexts/EditorStoreContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';

interface SubtitleOverlayProps {
  overlayController: SubtitleOverlayController;
  manipulationController: OverlayManipulationController;
  selectionController: OverlaySelectionController;
  document: Document;
  sheets: Sheet[];
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  videoDuration: number;
  /** Extra content rendered inside the video coordinate space, above subtitles. */
  videoOverlay?: ReactNode;
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
  wordStyleOverrides,
  segmentOverrides,
  videoDuration,
  videoOverlay,
}: SubtitleOverlayProps) {
  const { constants } = useEngine();
  // Mobile is read-only: no selection, no popovers, no handlers.
  const isMobile = useIsMobileViewport();
  const activeSegments = useActiveSegments();
  const { cssBySheet, wrapperVarsBySheet, segmentPositions, sheetBySegmentId, activeSegmentIds } =
    useSheetArtifacts(doc, sheets, activeSegments);
  const { selection, popover, setSelection, dismiss, onClick, onContextMenu } =
    useSegmentSelection(activeSegmentIds, selectionController);

  const selectedSegmentId = selection?.segmentId ?? null;

  // The scaler box IS the `cqh`/`em` resolution target (see CSS), so its
  // px height is the factor the controller needs to resolve SVG filter
  // lengths. Push it on mount and on every resize. The same element is
  // the frame against which drag gestures measure cursor fractions.
  const scalerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scaler = scalerRef.current;
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
  }, [overlayController, manipulationController]);

  return (
    <OverlayControllerProvider value={overlayController}>
      <OverlayManipulationProvider value={manipulationController}>
      <div className="subtitle-overlay-container">
        <div
          ref={scalerRef}
          className="subtitle-overlay-scaler"
          style={SCALER_STYLE}
          onClick={isMobile ? undefined : onClick}
          onContextMenu={isMobile ? undefined : onContextMenu}
        >
          <PersistentVideoFrameProvider>
          {/* Same baseline the engine's BASELINE_CSS prepends in export. */}
          <style>{constants.VIDEO_FRAME_LAYER_BASELINE_CSS}</style>
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
          {activeSegments.map((segment) => {
            const sheet = sheetBySegmentId.get(segment.id);
            if (!sheet) return null;
            const wrapperVars = wrapperVarsBySheet[sheet.id];
            if (!wrapperVars) return null;
            const segIdx = segmentPositions.positionOf(sheet.id, segment.id);
            return (
              <ActiveSegmentLayer
                key={segment.id}
                segment={segment}
                sheet={sheet}
                segIdx={segIdx}
                isSelected={selectedSegmentId === segment.id}
                wordStyleOverrides={wordStyleOverrides}
                segmentOverrides={segmentOverrides}
                wrapperVars={wrapperVars}
              />
            );
          })}
          {videoOverlay}
          {!isMobile && <SnapGuides />}
          {!isMobile && <SegmentScopeChip selection={selection} />}
          {!isMobile && selection?.wordId && (
            <WordSelectionRing wordId={selection.wordId} containerRef={scalerRef} />
          )}
          {!isMobile && selection?.wordId && (
            <WordResizeHandles wordId={selection.wordId} containerRef={scalerRef} />
          )}
          {!isMobile && selection?.wordId && sheetBySegmentId.get(selection.segmentId)?.template.features.rotation.word && (
            <WordRotateHandle wordId={selection.wordId} containerRef={scalerRef} />
          )}
          </PersistentVideoFrameProvider>
        </div>
        <SubtitleOverlayPopovers
          doc={doc}
          sheets={sheets}
          sheetBySegmentId={sheetBySegmentId}
          selection={selection}
          popover={popover}
          setSelection={setSelection}
          dismiss={dismiss}
          wordStyleOverrides={wordStyleOverrides}
          segmentOverrides={segmentOverrides}
          videoDuration={videoDuration}
        />
      </div>
      </OverlayManipulationProvider>
    </OverlayControllerProvider>
  );
});

const SheetFilterDefs = memo(function SheetFilterDefs({ sheet }: { sheet: Sheet }) {
  const ref = useBoundSheetFilterDefs(sheet);
  return <g ref={ref} />;
});
