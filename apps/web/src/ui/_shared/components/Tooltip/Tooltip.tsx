import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  text: string;
  position?: TooltipPosition;
  tapToOpen?: boolean;
  children: ReactNode;
}

const CONTENT_CLASS =
  'z-[10000] max-w-[300px] px-2.5 py-1.5 rounded-xs bg-surface-2 border border-edge-subtle ' +
  'text-fg-secondary text-2xs leading-snug shadow-sm select-none ' +
  'data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out';

/**
 * Thin wrapper over Radix Tooltip. Radix gives us focus support, collision
 * detection, scroll/transform escape, and proper ARIA roles for free.
 *
 * `asChild` makes the trigger transparent — the child element (typically a
 * `<button>`) IS the trigger and receives Radix's hover/focus handlers
 * directly, no extra wrapper span. Children must be a single element that
 * forwards refs (DOM elements do this automatically).
 *
 * The global Provider lives in `main.tsx`; that's where delay timings are
 * tuned for the whole app.
 */
export function Tooltip({ text, position = 'top', tapToOpen = false, children }: TooltipProps) {
  if (tapToOpen) return <TooltipWithTapSupport text={text} position={position}>{children}</TooltipWithTapSupport>;
  return <TooltipHoverOnly text={text} position={position}>{children}</TooltipHoverOnly>;
}

interface VariantProps {
  text: string;
  position: TooltipPosition;
  children: ReactNode;
}

function TooltipHoverOnly({ text, position, children }: VariantProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={position}
          sideOffset={6}
          collisionPadding={8}
          className={CONTENT_CLASS}
        >
          {text}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

function TooltipWithTapSupport({ text, position, children }: VariantProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [tapMode, setTapMode] = useState<boolean>(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const openByTap = () => {
    setTapMode(true);
    setOpen(true);
  };

  const close = useCallback(() => {
    setTapMode(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open || !tapMode) return;
    const dismissIfOutside = (target: EventTarget | null) => {
      if (target instanceof Node && triggerRef.current?.contains(target)) return;
      close();
    };
    const onPointerDown = (e: PointerEvent) => dismissIfOutside(e.target);
    const onFocusIn = (e: FocusEvent) => dismissIfOutside(e.target);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, tapMode, close]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setTapMode(false);
      setOpen(true);
      return;
    }
    if (tapMode) return;
    setOpen(false);
  };

  return (
    <RadixTooltip.Root open={open} onOpenChange={handleOpenChange}>
      <RadixTooltip.Trigger asChild>
        <span ref={triggerRef} className="inline-flex" onClick={openByTap} onTouchEnd={openByTap}>
          {children}
        </span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={position}
          sideOffset={6}
          collisionPadding={8}
          className={CONTENT_CLASS}
        >
          {text}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
