// banned-words-allow-file: close,closed
import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { PopoverNavContext, type PopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

const CHROME =
  'z-[100] bg-surface-2 border border-edge-subtle rounded-sm shadow-md outline-none data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

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
    side = 'bottom', align = 'start', sideOffset = 4, collisionPadding = 8,
  } = props;

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
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
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
          collisionPadding={collisionPadding}
          className={CHROME}
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
