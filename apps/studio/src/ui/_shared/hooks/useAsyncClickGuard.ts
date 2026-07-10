import { useCallback, useRef, useState } from 'react';

/**
 * Guards a click handler against re-entry while its returned promise
 * is unsettled. Repeat calls are silently dropped until `pending`
 * returns to `false`. Handlers that return `void` are not gated —
 * there is no async window to protect.
 */
export function useAsyncClickGuard(
  onClick: () => Promise<unknown> | void,
): { handler: () => void; pending: boolean } {
  const latestOnClick = useRef(onClick);
  latestOnClick.current = onClick;
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const handler = useCallback(() => {
    if (inFlight.current) return;
    const result = latestOnClick.current();
    if (!(result instanceof Promise)) return;
    inFlight.current = true;
    setPending(true);
    void result.finally(() => {
      inFlight.current = false;
      setPending(false);
    });
  }, []);

  return { handler, pending };
}
