import { useCallback, useContext, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { PopoverNavContext, type PopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { FloatingLayerContext } from '@ui/_shared/components/Dialog/FloatingLayerContext';

const PAGE_LAYER = 'z-[100]';

const CHROME =
  'bg-surface-2 border border-edge-subtle rounded-sm shadow-md outline-none data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

interface BasePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Map of screen-id → screen content. The active screen is rendered alone. */
  screens: Record<string, ReactNode>;
  /** Defaults to the first key of `screens`. */
  initialScreen?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /**
   * Shifts the content along the alignment axis, in pixels. Lets a
   * trigger wider than the content place the popover somewhere inside
   * itself — at the point that was pressed, say — instead of at its
   * own edge. Collision handling still applies afterwards.
   */
  alignOffset?: number;
  collisionPadding?: number;
}

interface PopoverWithTrigger extends BasePopoverProps {
  /** A DOM-forwarding element (button/span/...) used as Radix trigger + anchor. */
  trigger: ReactElement;
  /** Optional Radix Tooltip text wrapping the trigger (kept inside Popover so the asChild chain stays valid). */
  triggerTooltip?: string;
  point?: never;
}

interface PopoverWithPoint extends BasePopoverProps {
  /** Viewport-space anchor (e.g. a context-menu click). Renders an invisible 0×0 div as Anchor. */
  point: { x: number; y: number };
  trigger?: never;
  triggerTooltip?: never;
}

export type PopoverProps = PopoverWithTrigger | PopoverWithPoint;

/**
 * Reusable popover wrapping Radix Popover. Handles three things callers used
 * to redo by hand:
 *
 *  1. Two anchor styles — a DOM trigger (sidebar buttons, word chips) and a
 *     viewport point (overlay context-menu). The point variant renders a
 *     fixed 0×0 div as `Popover.Anchor asChild`.
 *  2. Visual chrome (bg/border/shadow/animations/z) so screens only worry
 *     about their inner padding/layout/width.
 *  3. Stack-based screen navigation. Screens are rendered one at a time and
 *     read `usePopoverNav()` to `navigate(key)` / `back()` / `close()`.
 *     The stack resets to `initialScreen` every time the popover closes.
 *
 * `data-floating-layer` is set on the Content so the overlay's outside-click
 * handler treats the popover as inside.
 */
export function Popover(props: PopoverProps) {
  const {
    open, onOpenChange, screens, initialScreen,
    side = 'bottom', align = 'start', sideOffset = 4, alignOffset = 0, collisionPadding = 8,
  } = props;

  const hasTrigger = 'trigger' in props && props.trigger !== undefined;
  const layer = useContext(FloatingLayerContext) ?? PAGE_LAYER;
  const screenKeys = useMemo(() => Object.keys(screens), [screens]);
  const initial = initialScreen ?? screenKeys[0]!;
  const [stack, setStack] = useState<string[]>([initial]);

  // Nav stack resets on close so the next open lands on the initial screen.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (!open) setStack([initial]);
  }

  const navigate = useCallback((screen: string) => {
    setStack((s) => [...s, screen]);
  }, []);
  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  // Radix hands focus back to the trigger on close, which is right for a
  // dismissal and wrong for a pick: a trigger carrying a tooltip opens it
  // on focus, and the pointer that walked into the menu is no longer over
  // the trigger to dismiss it again, so the tooltip hangs over the page.
  // Only the trigger variant has this problem — a point anchor returns
  // focus to whatever the user was on, which is what should happen.
  const closedByPick = useRef(false);
  const close = useCallback(() => {
    closedByPick.current = true;
    onOpenChange(false);
  }, [onOpenChange]);
  const handleCloseAutoFocus = useCallback((event: Event) => {
    const picked = closedByPick.current;
    closedByPick.current = false;
    if (picked && hasTrigger) event.preventDefault();
  }, [hasTrigger]);
  const canGoBack = stack.length > 1;

  const nav = useMemo<PopoverNav>(
    () => ({ navigate, back, close, canGoBack }),
    [navigate, back, close, canGoBack],
  );

  const currentScreen = stack[stack.length - 1]!;
  const screenNode = screens[currentScreen] ?? null;

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      {'trigger' in props && props.trigger ? (
        props.triggerTooltip ? (
          <Tooltip text={props.triggerTooltip}>
            <RadixPopover.Trigger asChild>{props.trigger}</RadixPopover.Trigger>
          </Tooltip>
        ) : (
          <RadixPopover.Trigger asChild>{props.trigger}</RadixPopover.Trigger>
        )
      ) : null}
      {'point' in props && props.point ? (
        <RadixPopover.Anchor asChild>
          <div
            aria-hidden
            style={{
              position: 'fixed',
              top: props.point.y,
              left: props.point.x,
              width: 0,
              height: 0,
              pointerEvents: 'none',
            }}
          />
        </RadixPopover.Anchor>
      ) : null}
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          onCloseAutoFocus={handleCloseAutoFocus}
          className={`${CHROME} ${layer}`}
          data-floating-layer
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <PopoverNavContext.Provider value={nav}>
            {screenNode}
          </PopoverNavContext.Provider>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
