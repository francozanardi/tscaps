import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  getPanelElement,
  getPanelElementsForGroup,
  type ImperativePanelHandle,
} from 'react-resizable-panels';
import { useObservedHeightPx } from '@ui/_shared/hooks/useObservedHeightPx';

interface DesktopEditorLayoutProps {
  videoBox: ReactNode;
  playbackControls: ReactNode;
  sidebar: ReactNode;
  /** A panel left of the video, shown while `leadingPanelOpen`. It stays mounted while hidden. */
  leadingPanel?: ReactNode;
  leadingPanelOpen: boolean;
  /** Reports the leading panel opening or closing from the layout's side, such as a drag that folds it away. */
  onLeadingPanelOpenChange: (open: boolean) => void;
}

const GROUP_ID = 'editor-layout';
const LEADING_PANEL_ID = 'editor-leading';
const LEADING_PANEL_MIN_SIZE = 24;
const LEADING_PANEL_MAX_SIZE = 40;

// --motion-soft on --ease-travel: the panel crosses a good part of the screen, so the eye has to be able to follow it.
const SLIDE_MS = 320;
const SLIDE_TRANSITION = `flex-grow ${SLIDE_MS}ms var(--ease-travel)`;

const RESIZE_HANDLE = 'group/handle w-3 flex items-center justify-center cursor-col-resize';
const RESIZE_HANDLE_BAR =
  'w-[2px] h-10 rounded-full bg-edge-subtle group-hover/handle:bg-edge-strong group-data-[resize-handle-state=drag]/handle:bg-accent transition-colors duration-quick ease-standard';
const LEADING_CONTENT = 'h-full shrink-0 transition-opacity duration-soft ease-standard';

/**
 * Desktop editor layout. Horizontal `PanelGroup` with draggable splitters:
 * an optional leading panel, video + controls, then the sidebar. Sizes
 * persist via `react-resizable-panels`'s `autoSaveId`; whether the
 * leading panel is open is the caller's, and it starts folded away.
 *
 * Opening or closing the leading panel from the caller's side slides it
 * in or out; a drag that folds it away does not animate, since the hand
 * already moved it. While it slides, its content keeps its open width and
 * is clipped from the left, so nothing in it reflows.
 *
 * The video column is a container-query root that publishes its own
 * height in `cqh` units and the observed playback-controls height as
 * `--playback-controls-h`, so the video box can compute a max size
 * that fits the actual available space instead of a viewport-based
 * estimate.
 */
export function DesktopEditorLayout({
  videoBox,
  playbackControls,
  sidebar,
  leadingPanel,
  leadingPanelOpen,
  onLeadingPanelOpenChange,
}: DesktopEditorLayoutProps) {
  const playbackControlsRef = useRef<HTMLDivElement>(null);
  const playbackControlsHeightPx = useObservedHeightPx(playbackControlsRef);
  const leadingPanelRef = useRef<ImperativePanelHandle>(null);
  const hasLeadingPanel = leadingPanel !== undefined;
  const { run: slideLeadingPanel, contentWidthPx: slidingContentWidthPx } = useLeadingPanelSlide();

  // Before paint, so a layout restored with the panel open folds away
  // without being seen when the caller says it is shut.
  useLayoutEffect(() => {
    const panel = leadingPanelRef.current;
    if (!panel) return;
    if (leadingPanelOpen && panel.isCollapsed()) slideLeadingPanel(() => panel.expand(), () => panel.getSize());
    else if (!leadingPanelOpen && panel.isExpanded()) slideLeadingPanel(() => panel.collapse(), null);
  }, [leadingPanelOpen, hasLeadingPanel, slideLeadingPanel]);

  const showsLeadingContent = leadingPanelOpen || slidingContentWidthPx !== null;
  return (
    <PanelGroup
      id={GROUP_ID}
      direction="horizontal"
      autoSaveId="tscaps:editor-layout"
      className="w-full flex-1 min-h-0"
      data-tscaps-deselect-zone
    >
      {hasLeadingPanel && (
        <>
          <Panel
            id={LEADING_PANEL_ID}
            order={1}
            ref={leadingPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize={0}
            minSize={LEADING_PANEL_MIN_SIZE}
            maxSize={LEADING_PANEL_MAX_SIZE}
            onCollapse={() => onLeadingPanelOpenChange(false)}
            onExpand={() => onLeadingPanelOpenChange(true)}
            className="flex justify-end"
          >
            <div
              className={showsLeadingContent ? LEADING_CONTENT : 'hidden'}
              style={{
                width: slidingContentWidthPx === null ? '100%' : `${slidingContentWidthPx}px`,
                opacity: leadingPanelOpen ? 1 : 0,
              }}
            >
              {leadingPanel}
            </div>
          </Panel>
          <PanelResizeHandle className={leadingPanelOpen ? RESIZE_HANDLE : 'hidden'} disabled={!leadingPanelOpen}>
            <div className={RESIZE_HANDLE_BAR} />
          </PanelResizeHandle>
        </>
      )}

      <Panel id="editor-workbench" order={2} defaultSize={72} minSize={45}>
        <div
          className="h-full flex flex-col items-center justify-center min-h-0 gap-3 [container-type:size]"
          data-tscaps-deselect-zone
          style={{ ['--playback-controls-h' as string]: `${playbackControlsHeightPx}px` }}
        >
          {videoBox}
          <div ref={playbackControlsRef} className="w-full">
            {playbackControls}
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className={RESIZE_HANDLE}>
        <div className={RESIZE_HANDLE_BAR} />
      </PanelResizeHandle>

      <Panel id="editor-sidebar" order={3} defaultSize={28} minSize={25} maxSize={50}>
        {sidebar}
      </Panel>
    </PanelGroup>
  );
}

interface LeadingPanelSlide {
  /**
   * Resizes the leading panel through `resize`, sliding once the layout
   * has been on screen and jumping before that. `openSize` reads the
   * panel's size, in percent of the group, once `resize` ran; null when
   * it closes. Stable across renders.
   */
  readonly run: (resize: () => void, openSize: (() => number) | null) => void;
  /** The width its content holds while it slides, or null when it rests. */
  readonly contentWidthPx: number | null;
}

/**
 * Slides the panels of the layout to their new sizes with a transition
 * set on them for that one change only, so a drag on a splitter still
 * follows the hand.
 */
function useLeadingPanelSlide(): LeadingPanelSlide {
  const [contentWidthPx, setContentWidthPx] = useState<number | null>(null);
  const shown = useRef(false);
  const settle = useRef<(() => void) | null>(null);

  useEffect(() => {
    shown.current = true;
    return () => settle.current?.();
  }, []);

  const run = useCallback((resize: () => void, openSize: (() => number) | null) => {
    settle.current?.();
    const leading = getPanelElement(LEADING_PANEL_ID);
    if (!shown.current || leading === null || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      resize();
      return;
    }
    const panels = getPanelElementsForGroup(GROUP_ID);
    // The panels share what the splitters leave of the group; their sizes are percentages of that.
    const sharedWidth = panels.reduce((sum, panel) => sum + panel.getBoundingClientRect().width, 0);
    const closingWidth = leading.getBoundingClientRect().width;
    for (const panel of panels) panel.style.transition = SLIDE_TRANSITION;
    resize();
    setContentWidthPx(openSize === null ? closingWidth : (sharedWidth * openSize()) / 100);
    const timer = window.setTimeout(() => settle.current?.(), SLIDE_MS + 50);
    settle.current = () => {
      window.clearTimeout(timer);
      for (const panel of panels) panel.style.removeProperty('transition');
      setContentWidthPx(null);
      settle.current = null;
    };
  }, []);

  return { run, contentWidthPx };
}
