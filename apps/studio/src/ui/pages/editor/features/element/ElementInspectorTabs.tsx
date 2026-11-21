import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useEditorNavigationTelemetry } from '@ui/pages/editor/contexts/EditorNavigationTelemetryContext';
import { useInspectorPageRequest } from '@ui/pages/editor/hooks/useInspectorPageRequest';
import type { InspectorPageRequest } from '@presentation/editor/stores/EditorWorkspaceStore';
import { ScrollSlackSpacer } from '@ui/_shared/components/ScrollSlack/ScrollSlackSpacer';
import { ScrollFade } from '@ui/_shared/components/ScrollFade/ScrollFade';
import { ElementInspectorTabNavContext, type ElementInspectorTabNav } from '@ui/pages/editor/features/element/ElementInspectorTabNavContext';
import { SpotlightContext, type SpotlightRequest } from '@ui/pages/editor/features/element/SpotlightContext';

/** One page of the inspector: its name, its rail icon and what it shows. */
export interface ElementInspectorTab {
  readonly value: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly content: ReactNode;
}

interface ElementInspectorTabsProps {
  /** The pages, in rail order; the first is open until another is picked. */
  tabs: ReadonlyArray<ElementInspectorTab>;
  /** What the inspector is open on, as reported to analytics: `shot`, `graphic`, `word`… */
  elementKind: string;
}

// The same rail the captions panel uses, so the two panels read as one
// app rather than two: a vertical rail is what a tab set looks like in
// this pane.
const RAIL_TAB_CLASS =
  'shrink-0 w-16 py-1 lg:py-2 flex flex-col items-center justify-center gap-0.5 lg:gap-1 rounded-sm bg-transparent border-none cursor-pointer '
  + 'transition-[color,background-color,box-shadow] duration-quick ease-standard outline-none '
  + 'text-fg-muted hover:text-fg-secondary hover:bg-surface-2 '
  + 'data-[state=active]:text-accent data-[state=active]:bg-surface-3 data-[state=active]:shadow-raised '
  + 'focus-visible:ring-2 focus-visible:ring-accent/40';

const RAIL_TAB_LABEL_CLASS = 'text-3xs font-medium leading-none tracking-tighter whitespace-nowrap';

const RAIL_LIST_CLASS =
  'flex flex-row lg:flex-col gap-1 lg:gap-1.5 p-1 lg:p-2 '
  + 'border-t lg:border-t-0 lg:border-l border-edge-subtle '
  + 'shrink-0 bg-surface-0';

const CONTENT_CLASS =
  'thin-scroll flex-1 overflow-y-auto overflow-x-hidden min-h-0 -mx-2 px-2 pb-3 lg:pb-0 outline-none '
  + '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

/**
 * What can be said about one element, a page at a time, picked from a
 * rail: for a caption element how it looks, how it moves, what it does
 * to the video beneath it, for a word the sounds it plays, and its CSS; for a shot layer where it sits,
 * how it moves, the sounds it plays as it comes and goes, and its CSS.
 *
 * Which tab is open is remembered across elements of one kind. Someone
 * adjusting one property through several words is doing one task, and
 * landing back on the fields each time would be in the way. A tab the
 * element does not have opens the first. A panel may open it on a page
 * (`EditorWorkspaceStore.requestInspectorPage`), once, with the part of
 * it asked for scrolled into view and lit.
 *
 * Inactive tabs unmount. The code editor writes what it holds on the
 * way out, so leaving mid-edit keeps the edit.
 */
export function ElementInspectorTabs({ tabs, elementKind }: ElementInspectorTabsProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const workspace = useEditorWorkspaceStore();
  const pageRequest = useInspectorPageRequest();
  // A panel that opened the inspector on one of its pages: that page, once, picked as the request is first seen.
  const [seenRequest, setSeenRequest] = useState<InspectorPageRequest | null>(null);
  if (pageRequest !== null && pageRequest !== seenRequest) {
    setSeenRequest(pageRequest);
    setPicked(pageRequest.page);
    setSpotlight(pageRequest.spotlight);
  }
  useEffect(() => {
    if (pageRequest !== null) workspace.settleInspectorPageRequest(pageRequest);
  }, [pageRequest, workspace]);
  const nav = useMemo<ElementInspectorTabNav>(() => ({
    show: (value, key) => {
      setPicked(value);
      setSpotlight(key ?? null);
    },
  }), []);
  const spotlightRequest = useMemo<SpotlightRequest>(() => ({ key: spotlight, spotlit: () => setSpotlight(null) }), [spotlight]);
  const active = picked !== null && tabs.some((tab) => tab.value === picked) ? picked : (tabs[0]?.value ?? '');
  const navigationTelemetry = useEditorNavigationTelemetry();
  useEffect(() => {
    if (active !== '') navigationTelemetry.inspectorTabOpened(elementKind, active);
  }, [navigationTelemetry, elementKind, active]);

  return (
    <Tabs.Root
      value={active}
      onValueChange={setPicked}
      orientation="vertical"
      className="flex flex-col lg:flex-row flex-1 min-h-0"
    >
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
        <div className="relative flex-1 flex flex-col min-h-0 min-w-0 p-3 pb-0 lg:pb-3">
          <ElementInspectorTabNavContext.Provider value={nav}>
            <SpotlightContext.Provider value={spotlightRequest}>
              {tabs.map((tab) => <ElementInspectorTabPage key={tab.value} tab={tab} isOpen={tab.value === active} />)}
            </SpotlightContext.Provider>
          </ElementInspectorTabNavContext.Provider>
        </div>
      </div>

      <Tabs.List className={RAIL_LIST_CLASS} aria-label="Element properties">
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} className={RAIL_TAB_CLASS} aria-label={tab.label}>
            {tab.icon}
            <span className={RAIL_TAB_LABEL_CLASS}>{tab.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

/**
 * One page and, while it is open, the fade over its scroll edge. Each
 * page holds its own scroll ref, so the fade attaches afresh whenever
 * the page it measures changes.
 */
function ElementInspectorTabPage({ tab, isOpen }: { tab: ElementInspectorTab; isOpen: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <Tabs.Content value={tab.value} className={CONTENT_CLASS} ref={scrollRef}>
        {tab.content}
        <ScrollSlackSpacer />
      </Tabs.Content>
      {isOpen && <ScrollFade scrollRef={scrollRef} />}
    </>
  );
}
