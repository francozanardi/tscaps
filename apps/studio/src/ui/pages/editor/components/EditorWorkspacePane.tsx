import { memo, useMemo, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { EditorWorkspaceStore, type EditorModeId } from '@presentation/editor/stores/EditorWorkspaceStore';
import {
  EditorWorkspaceStoreProvider,
  useEditorWorkspaceStore,
} from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';

export interface EditorModeDescriptor {
  id: EditorModeId;
  label: string;
  icon: ReactNode;
  panel: ReactNode;
}

interface EditorWorkspacePaneProps {
  modes: readonly EditorModeDescriptor[];
}

const MODE_TABS_LIST_CLASS =
  'flex flex-row gap-1 p-1 bg-surface-1 border border-edge-subtle rounded-md shrink-0';

const MODE_TAB_TRIGGER_CLASS =
  'flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-sm bg-transparent border-none cursor-pointer ' +
  'text-sm font-medium ' +
  'transition-[color,background-color,box-shadow] duration-quick ease-standard outline-none ' +
  'text-fg-muted hover:text-fg-secondary hover:bg-surface-2 ' +
  'data-[state=active]:text-accent data-[state=active]:bg-surface-3 data-[state=active]:shadow-raised ' +
  'focus-visible:ring-2 focus-visible:ring-accent/40';

// `forceMount` keeps inactive panels in the DOM so each mode preserves
// its internal state (active sub-tab, scroll, popovers) across switches.
const MODE_TAB_CONTENT_CLASS = 'flex-1 min-h-0 outline-none data-[state=inactive]:hidden';

/**
 * Top-level pane for the editor's right side. Owns the workspace
 * store (active mode tab), publishes it to the subtree so panels and
 * descendants can subscribe to mode changes, and renders the mode
 * strip above the active mode's panel.
 */
export const EditorWorkspacePane = memo(function EditorWorkspacePane({ modes }: EditorWorkspacePaneProps) {
  const store = useMemo(() => new EditorWorkspaceStore(), []);
  return (
    <EditorWorkspaceStoreProvider value={store}>
      <EditorWorkspaceTabs modes={modes} />
    </EditorWorkspaceStoreProvider>
  );
});

interface EditorWorkspaceTabsProps {
  modes: readonly EditorModeDescriptor[];
}

function EditorWorkspaceTabs({ modes }: EditorWorkspaceTabsProps) {
  const store = useEditorWorkspaceStore();
  const activeId = useActiveEditorMode();
  return (
    <Tabs.Root
      value={activeId}
      onValueChange={(v) => store.setActiveMode(v as EditorModeId)}
      className="flex flex-col h-full min-h-0 gap-2 lg:gap-3"
    >
      <Tabs.List className={MODE_TABS_LIST_CLASS} aria-label="Editor mode">
        {modes.map((m) => (
          <Tabs.Trigger key={m.id} value={m.id} className={MODE_TAB_TRIGGER_CLASS}>
            {m.icon}
            <span>{m.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {modes.map((m) => (
        <Tabs.Content key={m.id} value={m.id} forceMount className={MODE_TAB_CONTENT_CLASS}>
          {m.panel}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
