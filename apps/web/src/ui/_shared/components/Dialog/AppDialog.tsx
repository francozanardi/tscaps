// banned-words-allow-file: close,closed
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export type AppDialogSize = 'sm' | 'md' | 'lg';

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  /** When true, ESC / outside-click won't close. Use for in-progress operations. */
  locked?: boolean;
  /** When false, click / pointer-down outside the content won't close. ESC and explicit cancel still work. Default true. */
  closeOnOutsideClick?: boolean;
  size?: AppDialogSize;
  /** Visible heading. Pass `titleSrOnly` to hide it visually (still announced). */
  title: ReactNode;
  titleSrOnly?: boolean;
  /** Optional descriptive paragraph below the title. */
  description?: ReactNode;
  /**
   * When true, renders a small X button at the top-right corner of the
   * dialog. Use for dialogs that don't have an explicit cancel button
   * in their footer (e.g. picker-style modals). Disabled while
   * `locked`.
   */
  showCloseButton?: boolean;
  /**
   * When true, the dialog renders on an elevated layer that sits above
   * other default-layer dialogs. Use for system-level modals that can
   * be invoked while another dialog is already open.
   */
  elevated?: boolean;
  children: ReactNode;
}

const OVERLAY_BASE =
  'fixed inset-0 bg-black/70 backdrop-blur-[2px] ' +
  'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

const CONTENT_BASE =
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-h-[90vh] overflow-y-auto ' +
  'bg-surface-2 border border-edge-subtle rounded-md shadow-md ' +
  'p-6 flex flex-col gap-4 focus:outline-none ' +
  'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

const DEFAULT_LAYER = { overlay: 'z-[1000]', content: 'z-[1001]' } as const;
const ELEVATED_LAYER = { overlay: 'z-[1100]', content: 'z-[1101]' } as const;

const SIZE_CLASS: Record<AppDialogSize, string> = {
  sm: 'max-w-[360px]',
  md: 'max-w-[440px]',
  lg: 'max-w-[560px]',
};

const TITLE = 'text-md font-semibold tracking-[-0.022em] text-fg-primary m-0';
const DESCRIPTION = 'text-sm text-fg-secondary leading-normal m-0';

/**
 * Centered modal chrome shared by every dialog in the app. Radix
 * handles focus trap, scroll lock, ARIA. `locked` blocks ESC / outside
 * click for operations the user must let finish (export, transcription).
 *
 * Compose footer actions inside `children` and use the canonical button
 * classnames from `_shared/styles/buttons` to stay aligned with the
 * identity.
 */
const CLOSE_BTN =
  'absolute top-3 right-3 inline-flex items-center justify-center w-7 h-7 rounded-xs ' +
  'text-fg-muted hover:text-fg-primary hover:bg-surface-3 ' +
  'transition-colors duration-quick ease-standard cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export function AppDialog({
  open,
  onClose,
  locked = false,
  closeOnOutsideClick = true,
  size = 'md',
  title,
  titleSrOnly = false,
  description,
  showCloseButton = false,
  elevated = false,
  children,
}: AppDialogProps) {
  const layer = elevated ? ELEVATED_LAYER : DEFAULT_LAYER;
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !locked) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${OVERLAY_BASE} ${layer.overlay}`} />
        <Dialog.Content
          className={`${CONTENT_BASE} ${layer.content} ${SIZE_CLASS[size]}`}
          onEscapeKeyDown={(e) => { if (locked) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (locked || !closeOnOutsideClick) e.preventDefault(); }}
          onInteractOutside={(e) => { if (locked || !closeOnOutsideClick) e.preventDefault(); }}
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
          data-floating-layer
        >
          {titleSrOnly ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <Dialog.Title className={TITLE}>{title}</Dialog.Title>
          )}
          {description !== undefined && (
            <Dialog.Description className={DESCRIPTION}>{description}</Dialog.Description>
          )}
          {showCloseButton && (
            <button
              type="button"
              aria-label="Close"
              className={CLOSE_BTN}
              onClick={onClose}
              disabled={locked}
            >
              <X width={16} height={16} strokeWidth={2} />
            </button>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Right-aligned footer slot for action buttons. */
export function AppDialogActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-1">{children}</div>;
}
