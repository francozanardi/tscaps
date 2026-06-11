import type { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface DesktopEditorLayoutProps {
  videoBox: ReactNode;
  playbackControls: ReactNode;
  sidebar: ReactNode;
}

/**
 * Desktop editor layout. Horizontal `PanelGroup` with a draggable splitter:
 * video + controls on the left, sidebar on the right. Sizes persist via
 * `react-resizable-panels`'s `autoSaveId`.
 */
export function DesktopEditorLayout({ videoBox, playbackControls, sidebar }: DesktopEditorLayoutProps) {
  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="tscaps:editor-layout"
      className="w-full flex-1 min-h-0"
    >
      <Panel defaultSize={72} minSize={45}>
        <div className="h-full flex flex-col items-center justify-center min-h-0 gap-3">
          {videoBox}
          {playbackControls}
        </div>
      </Panel>

      <PanelResizeHandle className="group/handle w-3 flex items-center justify-center cursor-col-resize">
        <div className="w-[2px] h-10 rounded-full bg-edge-subtle group-hover/handle:bg-edge-strong group-data-[resize-handle-state=drag]/handle:bg-accent transition-colors duration-quick ease-standard" />
      </PanelResizeHandle>

      <Panel defaultSize={28} minSize={25} maxSize={50}>
        {sidebar}
      </Panel>
    </PanelGroup>
  );
}
