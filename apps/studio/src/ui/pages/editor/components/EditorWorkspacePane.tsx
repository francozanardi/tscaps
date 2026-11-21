import { memo, useEffect, useRef, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { type EditorModeId } from '@presentation/editor/stores/EditorWorkspaceStore';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';
import { useIsElementInspectorOpen } from '@ui/pages/editor/hooks/useIsElementInspectorOpen';
import { useEditorNavigationTelemetry } from '@ui/pages/editor/contexts/EditorNavigationTelemetryContext';

/**
 * What a mode is in the workspace.
 *
 * `content` names a part of the project — the captions today, a
 * soundtrack or a set of b-rolls later. `tool` names a way of looking
 * at whatever the content modes hold, which is a smaller claim and
 * gets a smaller share of the strip.
 */
export type EditorModeRole = 'content' | 'tool';

export interface EditorModeDescriptor {
  id: EditorModeId;
  label: string;
  icon: ReactNode;
  panel: ReactNode;
  role: EditorModeRole;
}

interface EditorWorkspacePaneProps {
  /**
   * The modes offered, at least one. With a single mode there is nothing
   * to switch between: the strip is left out, and a request to open a
   * mode not offered here lands back on the one that is.
   */
  modes: readonly EditorModeDescriptor[];
  /** Stands in front of the modes while it is open, and renders nothing otherwise. */
  inspector: ReactNode;
}

const MODE_TABS_LIST_CLASS =
  'flex flex-row items-center gap-1 p-1 bg-surface-1 border border-edge-subtle rounded-md shrink-0';

const MODE_TAB_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-sm bg-transparent border-none cursor-pointer '
  + 'transition-[color,background-color,box-shadow] duration-quick ease-standard outline-none '
  + 'hover:bg-surface-2 '
  + 'data-[state=active]:text-accent data-[state=active]:bg-surface-3 data-[state=active]:shadow-raised '
  + 'focus-visible:ring-2 focus-visible:ring-accent/40';

const CONTENT_TAB_CLASS =
  `${MODE_TAB_BASE_CLASS} py-2 px-3 text-sm font-medium text-fg-muted hover:text-fg-secondary`;

// A tool is reached for, not lived in: it sits after the divider at the
// end of the strip, one type step down and one tone quieter at rest.
// It keeps the accent when active because "you are here" is the same
// answer everywhere in the app.
const TOOL_TAB_CLASS =
  `${MODE_TAB_BASE_CLASS} py-2 px-2 text-xs text-fg-faint hover:text-fg-secondary`;

// While the inspector is open the modes stay laid out at their own size behind it, only unseen. Taking them out of
// layout instead (`display: none`) loses each list's scroll, and a virtualized list measures every card at zero
// height and corrects its scroll for each one, so it comes back scrolled to its end.
const MODES_SHOWN_CLASS = 'contents';
const MODES_BEHIND_INSPECTOR_CLASS = 'absolute inset-0 invisible flex flex-col gap-2 lg:gap-3';

const DIVIDER_CLASS = 'shrink-0 w-px h-4 bg-edge-subtle';

// `forceMount` keeps inactive panels in the DOM so each mode preserves
// its internal state (active sub-tab, scroll, popovers) across switches.
const MODE_TAB_CONTENT_CLASS = 'flex-1 min-h-0 outline-none data-[state=inactive]:hidden';

/**
 * Top-level pane for the editor's right side. Reads the active mode
 * from the ambient workspace store and renders the mode strip above
 * the active mode's panel, or the panel alone when only one mode is
 * offered.
 *
 * The modes are hidden rather than unmounted while the inspector is
 * open, so coming back out of it lands on the tab, the scroll and the
 * popover the user left behind.
 */
export const EditorWorkspacePane = memo(function EditorWorkspacePane({
  modes,
  inspector,
}: EditorWorkspacePaneProps) {
  const store = useEditorWorkspaceStore();
  const activeId = useActiveEditorMode();
  const isInspectorOpen = useIsElementInspectorOpen();
  const navigationTelemetry = useEditorNavigationTelemetry();
  const offersActiveMode = modes.some((m) => m.id === activeId);
  const fallbackModeId = modes[0]?.id;
  useEffect(() => {
    if (!offersActiveMode && fallbackModeId) store.setActiveMode(fallbackModeId);
  }, [store, offersActiveMode, fallbackModeId]);
  // The mode the pane opens on is the one it was left on, or the default:
  // only a switch made after that is someone opening a mode.
  const shownModeId = useRef<EditorModeId | null>(null);
  useEffect(() => {
    if (!offersActiveMode) return;
    const previousModeId = shownModeId.current;
    shownModeId.current = activeId;
    if (previousModeId !== null && previousModeId !== activeId) navigationTelemetry.modeOpened(activeId);
  }, [navigationTelemetry, activeId, offersActiveMode]);
  const showsModeStrip = modes.length > 1;
  const contentModes = modes.filter((m) => m.role === 'content');
  const toolModes = modes.filter((m) => m.role === 'tool');
  return (
    <Tabs.Root
      value={activeId}
      onValueChange={(v) => store.setActiveMode(v as EditorModeId)}
      className="relative flex flex-col h-full min-h-0 gap-2 lg:gap-3"
      data-tscaps-sidebar
    >
      <div className={isInspectorOpen ? MODES_BEHIND_INSPECTOR_CLASS : MODES_SHOWN_CLASS}>
        {showsModeStrip && (
          <Tabs.List className={MODE_TABS_LIST_CLASS} aria-label="Editor mode">
            {contentModes.map((m) => (
              <Tabs.Trigger key={m.id} value={m.id} className={CONTENT_TAB_CLASS}>
                {m.icon}
                <span>{m.label}</span>
              </Tabs.Trigger>
            ))}
            {toolModes.length > 0 && (
              <>
                <span className="flex-1" />
                <span className={DIVIDER_CLASS} aria-hidden />
              </>
            )}
            {toolModes.map((m) => (
              <Tabs.Trigger key={m.id} value={m.id} className={TOOL_TAB_CLASS}>
                {m.icon}
                <span>{m.label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        )}
        {modes.map((m) => (
          <Tabs.Content key={m.id} value={m.id} forceMount className={MODE_TAB_CONTENT_CLASS}>
            {m.panel}
          </Tabs.Content>
        ))}
      </div>
      {inspector}
    </Tabs.Root>
  );
});
