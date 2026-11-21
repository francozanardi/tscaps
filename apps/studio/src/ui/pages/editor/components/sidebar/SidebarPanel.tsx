import { useEffect, useMemo, useRef, type DragEvent, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { DragHoldTimer } from '@presentation/editor/controllers/DragHoldTimer';
import { ScrollSlackSpacer } from '@ui/_shared/components/ScrollSlack/ScrollSlackSpacer';
import { ScrollFade } from '@ui/_shared/components/ScrollFade/ScrollFade';

export interface SidebarPanelTab<Id extends string> {
  id: Id;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  /** Bottom fade over the scrolling body. Off for a body that brings its own chrome. */
  scrollFade?: boolean;
}

interface SidebarPanelProps<Id extends string> {
  tabs: ReadonlyArray<SidebarPanelTab<Id>>;
  activeTab: Id;
  onActiveTabChange: (id: Id) => void;
  /** Names the rail for assistive tech. */
  label: string;
  /**
   * Whether a drag carrying `types` opens a rail tab it is held over,
   * so what is dragged can be dropped on that tab's body. No drag does
   * when omitted.
   */
  opensTabOnDrag?: (types: readonly string[]) => boolean;
}

// Long enough that a drag passing over the rail does not switch tabs on its way.
const DRAG_HOLD_TO_OPEN_MS = 500;

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
// it from content; horizontal scroll if the tabs don't fit).
// Desktop (lg+): rail on the right, stacked vertical (left border).
const RAIL_LIST_CLASS =
  'flex flex-row lg:flex-col gap-1 lg:gap-1.5 p-1 lg:p-2 ' +
  'border-t lg:border-t-0 lg:border-l border-edge-subtle ' +
  'shrink-0 bg-surface-0 ' +
  'overflow-x-auto lg:overflow-x-visible ' +
  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

// Mobile: stack vertically (content on top, rail at bottom — last child).
// Desktop: row layout (content on left, rail on right).
const CARD_CLASS =
  'relative flex flex-col lg:flex-row h-full min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';

// `thin-scroll` paints the WebKit thumb (see `globals.css`); the inline
// `scrollbar-*` utilities cover Firefox. `-mr-2 pr-2` extends the scroll
// container 8px past the panel padding and pushes content 8px back, so the
// thumb has visual breathing room from the controls. Below `lg` the
// scroller runs down to the rail and carries the bottom padding itself, so
// content scrolls all the way under the fade instead of stopping at a flat
// band of panel padding.
const CONTENT_CLASS =
  'thin-scroll flex-1 overflow-y-auto min-h-0 -mr-2 pr-2 pb-3 lg:pb-0 outline-none ' +
  '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

/** Size every rail icon is drawn at, so each panel's icons match the rail they sit in. */
export const SIDEBAR_RAIL_ICON_SIZE = 22;

/**
 * The editor sidebar's card: one tab's body beside the icon rail that
 * switches it. Inactive bodies unmount, so a tab opens on its own
 * defaults rather than on where it was left.
 *
 * Selection is the caller's — each panel keeps it in a store of its own,
 * so which tab is open survives switching modes.
 */
export function SidebarPanel<Id extends string>({ tabs, activeTab, onActiveTabChange, label, opensTabOnDrag }: SidebarPanelProps<Id>) {
  // Only the open body is mounted, so one ref holds whichever it is.
  // The fade is keyed by tab so it re-reads that element on a switch,
  // which a ref whose identity never changes would not tell it to do.
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = tabs.find((tab) => tab.id === activeTab) ?? null;
  const dragHold = useMemo(() => new DragHoldTimer<Id>(DRAG_HOLD_TO_OPEN_MS), []);
  useEffect(() => () => dragHold.cancel(), [dragHold]);
  const holdDragOver = (id: Id) => (event: DragEvent) => {
    if (id === activeTab || !opensTabOnDrag?.(event.dataTransfer.types)) return;
    dragHold.hold(id, () => onActiveTabChange(id));
  };
  // Crossing from the tab onto its own icon or label is not leaving it.
  const leaveDragOver = (event: DragEvent) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    dragHold.cancel();
  };

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(v) => onActiveTabChange(v as Id)}
      orientation="vertical"
      className={CARD_CLASS}
    >
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0 p-3 pb-0 lg:pb-3">
        {tabs.map((tab) => (
          <Tabs.Content key={tab.id} value={tab.id} className={CONTENT_CLASS} ref={tab.id === activeTab ? scrollRef : undefined}>
            {tab.content}
            <ScrollSlackSpacer />
          </Tabs.Content>
        ))}
        {active && active.scrollFade !== false && <ScrollFade key={active.id} scrollRef={scrollRef} />}
      </div>

      <Tabs.List className={RAIL_LIST_CLASS} aria-label={label}>
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            className={RAIL_TAB_CLASS}
            aria-label={tab.label}
            onDragOver={holdDragOver(tab.id)}
            onDragLeave={leaveDragOver}
            onDrop={() => dragHold.cancel()}
          >
            {tab.icon}
            <span className={RAIL_TAB_LABEL_CLASS}>{tab.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
