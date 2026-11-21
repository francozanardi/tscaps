import { memo, useCallback, useEffect, useState } from 'react';
import { AudioLines, Clapperboard, Film, Palette, Proportions } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { VideoTabId } from '@presentation/editor/stores/VideoTabStore';
import type { MediaBinScope } from '@presentation/media/services/MediaBinPresenter';
import { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';
import { SidebarPanel, SIDEBAR_RAIL_ICON_SIZE, type SidebarPanelTab } from '@ui/pages/editor/components/sidebar/SidebarPanel';
import { ShotsTab } from '@ui/pages/editor/features/shots/ShotsTab';
import { SHOT_FILE_TYPES } from '@ui/pages/editor/features/shots/shotFileAccept';
import { MediaTab } from '@ui/pages/editor/features/media/MediaTab';
import { AudioTab } from '@ui/pages/editor/features/audio/AudioTab';
import { OutputFrameTab } from '@ui/pages/editor/features/output-frame/OutputFrameTab';
import { ColorGradeTab } from '@ui/pages/editor/features/color-grade/ColorGradeTab';
import { useVideoTabStore } from '@ui/pages/editor/contexts/VideoTabContext';
import { useActiveVideoTab } from '@ui/pages/editor/hooks/useActiveVideoTab';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';
import { useEditorNavigationTelemetry } from '@ui/pages/editor/contexts/EditorNavigationTelemetryContext';

/**
 * The picture itself: the shots it is cut into, what shows over each,
 * the media files there are to show, what the video sounds like, the
 * shape it is exported in, and its colour.
 *
 * Peer of the captions panel rather than a tab inside it — what is
 * answered here is a part of the project, not a lens over the words.
 */
interface VideoPanelProps {
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
  /** What shot posters are taken from — the proxy where there is one, the original otherwise. */
  posterSource: Blob | null;
  videoAspectRatio: number | null;
  /** The video's own size, or null while it is not known. */
  videoLayout: VideoLayout | null;
  outputFrame: OutputFrame;
  colorGrade: ColorGrade;
  isPlaying: boolean;
  projectId: string | null;
}

const DRAG_FORMAT = new MediaAssetDragFormat();

export const VideoPanel = memo(function VideoPanel({
  originalDocument,
  originalSheets,
  originalDecorationOverrides,
  shots,
  videoDurationSec,
  pictureChangesSec,
  posterSource,
  videoAspectRatio,
  videoLayout,
  outputFrame,
  colorGrade,
  isPlaying,
  projectId,
}: VideoPanelProps) {
  const tabStore = useVideoTabStore();
  const activeTab = useActiveVideoTab();
  const activeMode = useActiveEditorMode();
  const navigationTelemetry = useEditorNavigationTelemetry();
  // The panel stays mounted behind the other modes, so a tab counts as opened only while this mode is the one shown.
  useEffect(() => {
    if (activeMode === 'video') navigationTelemetry.videoTabOpened(activeTab);
  }, [navigationTelemetry, activeMode, activeTab]);
  // Held here rather than in the Media tab, which unmounts whenever another tab is shown.
  const [mediaScope, setMediaScope] = useState<MediaBinScope>('project');
  // Any file a shot can show, held over the rail, opens the Shots tab; a sound cannot go on a shot.
  const opensTabOnDrag = useCallback((types: readonly string[]) => DRAG_FORMAT.carries(types, SHOT_FILE_TYPES), []);

  const tabs: ReadonlyArray<SidebarPanelTab<VideoTabId>> = [
    {
      id: 'shots',
      label: 'Shots',
      icon: <Film size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: (
        <ShotsTab
          originalDocument={originalDocument}
          originalSheets={originalSheets}
          originalDecorationOverrides={originalDecorationOverrides}
          shots={shots}
          videoDurationSec={videoDurationSec}
          pictureChangesSec={pictureChangesSec}
          posterSource={posterSource}
          videoAspectRatio={videoAspectRatio}
          isPlaying={isPlaying}
          projectId={projectId}
        />
      ),
    },
    {
      id: 'media',
      label: 'Media',
      icon: <Clapperboard size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: (
        <MediaTab
          shots={shots}
          projectId={projectId}
          scope={mediaScope}
          onScopeChange={setMediaScope}
          hasShots={originalDocument !== null && videoDurationSec > 0}
        />
      ),
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: <AudioLines size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: (
        <AudioTab
          originalDocument={originalDocument}
          originalSheets={originalSheets}
          originalDecorationOverrides={originalDecorationOverrides}
          shots={shots}
          videoDurationSec={videoDurationSec}
          projectId={projectId}
        />
      ),
    },
    {
      id: 'aspect-ratio',
      label: 'Ratio',
      icon: <Proportions size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: <OutputFrameTab outputFrame={outputFrame} videoLayout={videoLayout} />,
    },
    {
      id: 'color',
      label: 'Color',
      icon: <Palette size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: (
        <ColorGradeTab
          colorGrade={colorGrade}
          posterSource={posterSource}
          videoDurationSec={videoDurationSec}
          videoAspectRatio={videoAspectRatio}
        />
      ),
    },
  ];

  return (
    <SidebarPanel
      tabs={tabs}
      activeTab={activeTab}
      onActiveTabChange={(id) => tabStore.setActiveTab(id)}
      label="Video sections"
      opensTabOnDrag={opensTabOnDrag}
    />
  );
});
