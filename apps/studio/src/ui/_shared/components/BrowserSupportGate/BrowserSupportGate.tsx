import type { ReactNode } from 'react';
import { MonitorX } from 'lucide-react';

interface BrowserSupportGateProps {
  /** Whether this browser can do what the children offer; when it can, they render untouched. */
  readonly supported: boolean;
  /** What cannot be done in this browser, as one sentence the reader sees under the children. */
  readonly message: string;
  readonly children: ReactNode;
}

// A disabled fieldset disables every control inside it natively — no
// click, no focus — so the gate holds whatever the children are.
const FIELDSET = 'm-0 p-0 border-0 min-w-0 opacity-50 cursor-not-allowed';
const MESSAGE = 'flex items-start gap-1 px-2 pb-1 text-3xs leading-snug text-danger/85';

/**
 * Something this browser cannot do, kept in view but out of reach: the
 * children dimmed and disabled, with a line under them saying why. The
 * last resort where no fallback exists for this browser; the reader
 * sees what is there and why it does nothing, instead of a control
 * that silently fails.
 */
export function BrowserSupportGate({ supported, message, children }: BrowserSupportGateProps) {
  if (supported) return <>{children}</>;
  return (
    <div role="group" aria-label={message}>
      <fieldset disabled className={FIELDSET}>{children}</fieldset>
      <span className={MESSAGE}>
        <MonitorX size={11} className="shrink-0 mt-px" aria-hidden />
        {message}
      </span>
    </div>
  );
}
