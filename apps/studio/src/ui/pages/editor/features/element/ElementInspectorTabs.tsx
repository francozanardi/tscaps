import { useRef, useState, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Blend, Code2, Orbit, Palette } from 'lucide-react';
import { ScrollFade } from '@ui/_shared/components/ScrollFade/ScrollFade';

const STYLE = 'style';
const MOTION = 'motion';
const EFFECTS = 'effects';
const CODE = 'code';

interface ElementInspectorTabsProps {
  style: ReactNode;
  motion: ReactNode;
  effects: ReactNode;
  code: ReactNode;
}

const ICON_SIZE = 22;

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
  'thin-scroll flex-1 overflow-y-auto min-h-0 -mr-2 pr-2 outline-none '
  + '[scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';

/**
 * What can be said about one element: how it looks, how it moves, what
 * it does to the video beneath it, and the CSS the first two are a view
 * of.
 *
 * Which tab is open is remembered across elements. Someone adjusting
 * one property through several words is doing one task, and landing
 * back on the fields each time would be in the way.
 *
 * Inactive tabs unmount. The code editor writes what it holds on the
 * way out, so leaving mid-edit keeps the edit.
 */
export function ElementInspectorTabs({ style, motion, effects, code }: ElementInspectorTabsProps) {
  const [active, setActive] = useState<string>(STYLE);
  // Per-tab refs so `ScrollFade` reattaches on tab change: its effect
  // depends on the ref's identity, and one shared ref would never
  // retrigger it.
  const styleRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const effectsRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const openRef = { [STYLE]: styleRef, [MOTION]: motionRef, [EFFECTS]: effectsRef, [CODE]: codeRef }[active] ?? styleRef;

  return (
    <Tabs.Root
      value={active}
      onValueChange={setActive}
      orientation="vertical"
      className="flex flex-col lg:flex-row flex-1 min-h-0"
    >
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
        <div className="relative flex-1 flex flex-col min-h-0 min-w-0 p-3">
          <Tabs.Content value={STYLE} className={CONTENT_CLASS} ref={styleRef}>{style}</Tabs.Content>
          <Tabs.Content value={MOTION} className={CONTENT_CLASS} ref={motionRef}>{motion}</Tabs.Content>
          <Tabs.Content value={EFFECTS} className={CONTENT_CLASS} ref={effectsRef}>{effects}</Tabs.Content>
          <Tabs.Content value={CODE} className={CONTENT_CLASS} ref={codeRef}>{code}</Tabs.Content>
          <ScrollFade scrollRef={openRef} />
        </div>
      </div>

      <Tabs.List className={RAIL_LIST_CLASS} aria-label="Element properties">
        <Tabs.Trigger value={STYLE} className={RAIL_TAB_CLASS} aria-label="Style">
          <Palette size={ICON_SIZE} />
          <span className={RAIL_TAB_LABEL_CLASS}>Style</span>
        </Tabs.Trigger>
        <Tabs.Trigger value={MOTION} className={RAIL_TAB_CLASS} aria-label="Motion">
          <Orbit size={ICON_SIZE} />
          <span className={RAIL_TAB_LABEL_CLASS}>Motion</span>
        </Tabs.Trigger>
        <Tabs.Trigger value={EFFECTS} className={RAIL_TAB_CLASS} aria-label="Effects">
          <Blend size={ICON_SIZE} />
          <span className={RAIL_TAB_LABEL_CLASS}>Effects</span>
        </Tabs.Trigger>
        <Tabs.Trigger value={CODE} className={RAIL_TAB_CLASS} aria-label="Code">
          <Code2 size={ICON_SIZE} />
          <span className={RAIL_TAB_LABEL_CLASS}>Code</span>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );
}
