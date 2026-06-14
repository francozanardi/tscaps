import { memo, useRef, useState, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { LayoutTemplate, Subtitles, Type, Palette, Move, Sparkles, WrapText, Code2 } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { AppError } from '@core/_shared/domain/AppError';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import { ScrollFade } from '@ui/_shared/components/ScrollFade/ScrollFade';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { CaptionsHost } from '@ui/pages/editor/features/captions/CaptionsHost';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { TemplatesTab } from '@ui/pages/editor/components/sidebar/tabs/TemplatesTab';
import { TypographyTab } from '@ui/pages/editor/components/sidebar/tabs/TypographyTab';
import { StyleTab } from '@ui/pages/editor/components/sidebar/tabs/StyleTab';
import { PositionTab } from '@ui/pages/editor/components/sidebar/tabs/PositionTab';
import { EffectsTab } from '@ui/pages/editor/components/sidebar/tabs/EffectsTab';
import { LayoutTab } from '@ui/pages/editor/components/sidebar/tabs/LayoutTab';
import { CodeTab } from '@ui/pages/editor/components/sidebar/tabs/CodeTab';

type TabId = 'templates' | 'captions' | 'typography' | 'style' | 'position' | 'effects' | 'layout' | 'code';

interface EditorSidebarProps {
  sheets: Sheet[];
  activeSheet: Sheet | null;
  templates: Template[];
  library: TemplateLibraryView;
  document: Document | null;
  activeSegmentId: string | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  videoDuration: number;
  isPlaying: boolean;
  error: AppError | null;
  isMobileDevice: boolean;
  onSetActiveSheet: (sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onRenameSheet: (sheetId: string, name: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onCopyStylesFromSheet: (targetSheetId: string, sourceSheetId: string) => void;
}

interface RailEntry {
  id: TabId;
  label: string;
  icon: ReactNode;
}

// Active state is driven by Radix's `data-state` attribute through Tailwind's
// `data-[state=active]:` modifiers — no per-render conditional needed.
// `text-accent` on the active icon/label is the primary visual marker; the
// surface lift + shadow are reinforcement.
// `shrink-0` keeps the tabs at full width on mobile when the rail scrolls
// horizontally (8 tabs at w-16 ~ 512px don't fit on a 375px screen).
// Mobile uses tighter padding/gap to keep the bottom bar compact.
// The label uses `text-3xs` (11px) + `tracking-tighter`: Inter is wider than
// system fonts, so the longest label ("Typography") needs the compression to
// stay inside `w-16`. See DESIGN_IDENTITY.md §Typography.
const RAIL_TAB_CLASS =
  'shrink-0 w-16 py-1 lg:py-2 flex flex-col items-center justify-center gap-0.5 lg:gap-1 rounded-sm bg-transparent border-none cursor-pointer ' +
  'transition-[color,background-color,box-shadow] duration-quick ease-standard outline-none ' +
  'text-fg-muted hover:text-fg-secondary hover:bg-surface-2 ' +
  'data-[state=active]:text-accent data-[state=active]:bg-surface-3 data-[state=active]:shadow-raised ' +
  'focus-visible:ring-2 focus-visible:ring-accent/40';

const RAIL_TAB_LABEL_CLASS =
  'text-3xs font-medium leading-none tracking-tighter whitespace-nowrap';

// Mobile: rail sits at the bottom as a horizontal bar (top border separates
// it from content; horizontal scroll if the 7 tabs don't fit).
// Desktop (lg+): rail on the right, stacked vertical (left border).
const RAIL_LIST_CLASS =
  'flex flex-row lg:flex-col gap-1 lg:gap-1.5 p-1 lg:p-2 ' +
  'border-t lg:border-t-0 lg:border-l border-edge-subtle ' +
  'shrink-0 bg-surface-0 ' +
  'overflow-x-auto lg:overflow-x-visible ' +
  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

// Mobile: stack vertically (content on top, rail at bottom — last child).
// Desktop: row layout (content on left, rail on right).
const SIDEBAR_CARD_CLASS =
  'relative flex flex-col lg:flex-row h-full min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';

// `sidebar-scroll` paints the WebKit thumb (see `globals.css`); the inline
// `scrollbar-*` utilities cover Firefox. `-mr-2 pr-2` extends the scroll
// container 8px past the panel padding and pushes content 8px back, so the
// thumb has visual breathing room from the controls.
const SIDEBAR_CONTENT_CLASS =
  'sidebar-scroll flex-1 overflow-y-auto min-h-0 -mr-2 pr-2 outline-none ' +
  '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

const ICON_SIZE = 22;

const RAIL: RailEntry[] = [
  { id: 'templates',  label: 'Templates',  icon: <LayoutTemplate    size={ICON_SIZE} /> },
  { id: 'captions',   label: 'Captions',   icon: <Subtitles         size={ICON_SIZE} /> },
  { id: 'typography', label: 'Typography', icon: <Type              size={ICON_SIZE} /> },
  { id: 'style',      label: 'Style',      icon: <Palette           size={ICON_SIZE} /> },
  { id: 'position',   label: 'Position',   icon: <Move              size={ICON_SIZE} /> },
  { id: 'effects',    label: 'Effects',    icon: <Sparkles          size={ICON_SIZE} /> },
  { id: 'layout',     label: 'Layout',     icon: <WrapText          size={ICON_SIZE} /> },
  { id: 'code',       label: 'Code',       icon: <Code2             size={ICON_SIZE} /> },
];

export const EditorSidebar = memo(function EditorSidebar(props: EditorSidebarProps) {
  const {
    sheets, activeSheet, templates, library, document, activeSegmentId,
    wordStyleOverrides, segmentOverrides, videoDuration, isPlaying, error, isMobileDevice,
    onSetActiveSheet, onCreateSheet, onRenameSheet, onDeleteSheet, onCopyStylesFromSheet,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>('templates');

  // Per-tab refs so `ScrollFade` reattaches on tab change. ScrollFade's
  // effect depends on the RefObject identity — sharing one ref across all
  // Tabs.Content would not retrigger it on switch.
  const templatesRef = useRef<HTMLDivElement>(null);
  const captionsRef = useRef<HTMLDivElement>(null);
  const typographyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);
  const effectsRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  const refsByTab: Record<TabId, React.RefObject<HTMLDivElement>> = {
    templates: templatesRef,
    captions: captionsRef,
    typography: typographyRef,
    style: styleRef,
    position: positionRef,
    effects: effectsRef,
    layout: layoutRef,
    code: codeRef,
  };

  const sheetScopeProps = activeSheet
    ? {
        sheets,
        activeSheet,
        onSetActiveSheet,
        onCreateSheet,
        onRenameSheet,
        onDeleteSheet,
        onCopyStylesFromSheet,
      }
    : null;

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as TabId)}
      orientation="vertical"
      className={SIDEBAR_CARD_CLASS}
    >
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0 p-3">
        <Tabs.Content value="templates" className={SIDEBAR_CONTENT_CLASS} ref={templatesRef}>
          {sheetScopeProps && (
            <TemplatesTab
              sheetScope={sheetScopeProps}
              templates={templates}
              library={library}
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="captions" className={SIDEBAR_CONTENT_CLASS} ref={captionsRef}>
          <EditorTab title="Captions">
            <CaptionsHost
              document={document}
              activeSegmentId={activeSegmentId}
              sheets={sheets}
              activeSheetId={activeSheet?.id ?? null}
              wordStyleOverrides={wordStyleOverrides}
              segmentOverrides={segmentOverrides}
              videoDuration={videoDuration}
              isPlaying={isPlaying}
            />
          </EditorTab>
        </Tabs.Content>

        <Tabs.Content value="typography" className={SIDEBAR_CONTENT_CLASS} ref={typographyRef}>
          {sheetScopeProps && <TypographyTab sheetScope={sheetScopeProps} />}
        </Tabs.Content>

        <Tabs.Content value="style" className={SIDEBAR_CONTENT_CLASS} ref={styleRef}>
          {sheetScopeProps && <StyleTab sheetScope={sheetScopeProps} />}
        </Tabs.Content>

        <Tabs.Content value="position" className={SIDEBAR_CONTENT_CLASS} ref={positionRef}>
          {sheetScopeProps && <PositionTab sheetScope={sheetScopeProps} />}
        </Tabs.Content>

        <Tabs.Content value="effects" className={SIDEBAR_CONTENT_CLASS} ref={effectsRef}>
          {sheetScopeProps && <EffectsTab sheetScope={sheetScopeProps} />}
        </Tabs.Content>

        <Tabs.Content value="layout" className={SIDEBAR_CONTENT_CLASS} ref={layoutRef}>
          {sheetScopeProps && (
            <LayoutTab
              sheetScope={sheetScopeProps}
              document={document}
              segmentOverrides={segmentOverrides}
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="code" className={SIDEBAR_CONTENT_CLASS} ref={codeRef}>
          {sheetScopeProps && <CodeTab sheetScope={sheetScopeProps} />}
        </Tabs.Content>

        {error && (
          <div className="shrink-0 mt-3 pt-3 border-t border-edge-subtle">
            <div
              role="alert"
              className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xs px-3 py-2 space-y-1"
            >
              <p className="font-semibold m-0">{getAppErrorTitle(error)}</p>
              <div className="text-fg-secondary">
                <AppErrorMessage error={error} isMobile={isMobileDevice} />
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'captions' && !error && <ScrollFade scrollRef={refsByTab[activeTab]} />}
      </div>

      <Tabs.List className={RAIL_LIST_CLASS} aria-label="Editor sections">
        {RAIL.map(({ id, label, icon }) => (
          <Tabs.Trigger key={id} value={id} className={RAIL_TAB_CLASS} aria-label={label}>
            {icon}
            <span className={RAIL_TAB_LABEL_CLASS}>{label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
});
