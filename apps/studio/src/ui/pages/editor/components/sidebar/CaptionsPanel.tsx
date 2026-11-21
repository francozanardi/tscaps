import { memo } from 'react';
import { LayoutTemplate, Subtitles, Type, Palette, Move, Orbit, Sparkles, WrapText, Code2 } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetCreationOption } from '@core/sheets/domain/SheetCreationOption';
import type { Template } from '@core/templates/domain/Template';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import type { CaptionsTabId } from '@presentation/editor/stores/CaptionsTabStore';
import { SidebarPanel, SIDEBAR_RAIL_ICON_SIZE, type SidebarPanelTab } from '@ui/pages/editor/components/sidebar/SidebarPanel';
import { TranscriptHost } from '@ui/pages/editor/features/transcript/TranscriptHost';
import { TemplatesTab } from '@ui/pages/editor/components/sidebar/tabs/TemplatesTab';
import { TypographyTab } from '@ui/pages/editor/components/sidebar/tabs/TypographyTab';
import { StyleTab } from '@ui/pages/editor/components/sidebar/tabs/StyleTab';
import { PositionTab } from '@ui/pages/editor/components/sidebar/tabs/PositionTab';
import { EffectsTab } from '@ui/pages/editor/components/sidebar/tabs/EffectsTab';
import { MotionTab } from '@ui/pages/editor/components/sidebar/tabs/motion/MotionTab';
import { LayoutTab } from '@ui/pages/editor/components/sidebar/tabs/LayoutTab';
import { CodeTab } from '@ui/pages/editor/components/sidebar/tabs/CodeTab';
import { useCaptionsTabStore } from '@ui/pages/editor/contexts/CaptionsTabContext';
import { useActiveCaptionsTab } from '@ui/pages/editor/hooks/useActiveCaptionsTab';

interface CaptionsPanelProps {
  sheets: Sheet[];
  activeSheet: Sheet | null;
  templates: Template[];
  library: TemplateLibraryView;
  document: Document | null;
  activeSegmentId: string | null;
  elementStyles: ElementStyles;
  frozenSegments: FrozenSegmentSet;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
  onSetActiveSheet: (sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  sheetCreationOptions: ReadonlyArray<SheetCreationOption>;
  onCreateSheetFromOption: (option: SheetCreationOption) => void;
  onRenameSheet: (sheetId: string, name: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onCopyStylesFromSheet: (targetSheetId: string, sourceSheetId: string) => void;
  onLinkSheet: (targetSheetId: string, sourceSheetId: string) => void;
  onUnlinkSheet: (sheetId: string) => void;
  onResetSheetToTemplateDefaults: (sheetId: string) => void;
}


export const CaptionsPanel = memo(function CaptionsPanel(props: CaptionsPanelProps) {
  const {
    sheets, activeSheet, templates, library, document, activeSegmentId,
    elementStyles, frozenSegments, decorationOverrides, videoDuration, isPlaying,
    onSetActiveSheet, onCreateSheet, sheetCreationOptions, onCreateSheetFromOption,
    onRenameSheet, onDeleteSheet, onCopyStylesFromSheet,
    onLinkSheet, onUnlinkSheet, onResetSheetToTemplateDefaults,
  } = props;

  const tabStore = useCaptionsTabStore();
  const activeTab = useActiveCaptionsTab();

  const sheetScopeProps = activeSheet
    ? {
        sheets,
        activeSheet,
        onSetActiveSheet,
        onCreateSheet,
        sheetCreationOptions,
        onCreateSheetFromOption,
        onRenameSheet,
        onDeleteSheet,
        onCopyStylesFromSheet,
        onLinkSheet,
        onUnlinkSheet,
        onResetSheetToTemplateDefaults,
      }
    : null;

  const tabs: ReadonlyArray<SidebarPanelTab<CaptionsTabId>> = [
    {
      id: 'templates',
      label: 'Templates',
      icon: <LayoutTemplate size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && (
        <TemplatesTab sheetScope={sheetScopeProps} templates={templates} library={library} />
      ),
    },
    {
      id: 'transcript',
      label: 'Transcript',
      icon: <Subtitles size={SIDEBAR_RAIL_ICON_SIZE} />,
      scrollFade: false,
      content: (
        <TranscriptHost
          document={document}
          activeSegmentId={activeSegmentId}
          sheets={sheets}
          elementStyles={elementStyles}
          frozenSegments={frozenSegments}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
          isPlaying={isPlaying}
        />
      ),
    },
    {
      id: 'typography',
      label: 'Typography',
      icon: <Type size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && <TypographyTab sheetScope={sheetScopeProps} />,
    },
    {
      id: 'style',
      label: 'Style',
      icon: <Palette size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && <StyleTab sheetScope={sheetScopeProps} />,
    },
    {
      id: 'position',
      label: 'Position',
      icon: <Move size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && <PositionTab sheetScope={sheetScopeProps} />,
    },
    {
      id: 'motion',
      label: 'Motion',
      icon: <Orbit size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && <MotionTab sheetScope={sheetScopeProps} document={document} />,
    },
    {
      id: 'effects',
      label: 'Effects',
      icon: <Sparkles size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && <EffectsTab sheetScope={sheetScopeProps} />,
    },
    {
      id: 'layout',
      label: 'Layout',
      icon: <WrapText size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && (
        <LayoutTab sheetScope={sheetScopeProps} document={document} frozenSegments={frozenSegments} />
      ),
    },
    {
      id: 'code',
      label: 'Code',
      icon: <Code2 size={SIDEBAR_RAIL_ICON_SIZE} />,
      content: sheetScopeProps && <CodeTab sheetScope={sheetScopeProps} />,
    },
  ];

  return (
    <SidebarPanel
      tabs={tabs}
      activeTab={activeTab}
      onActiveTabChange={(id) => tabStore.setActiveTab(id)}
      label="Editor sections"
    />
  );
});
