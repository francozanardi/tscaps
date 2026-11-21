import { useCallback, useEffect, useRef, useState } from 'react';

/** A draft the user edits, what changing it does, and what flushes it now. */
export interface DebouncedDraft<T> {
  readonly draft: T;
  readonly change: (next: T) => void;
  readonly flush: () => void;
}

/**
 * Holds what the user is typing as a draft, written through `write`
 * once they pause for `delayMs`, or at once on `flush` (on blur) and
 * when the field goes away. While a write is pending the draft stays as
 * typed; otherwise it follows `stored`, so an undo shows. `identity`
 * names what is being edited: a new one drops the draft.
 */
export function useDebouncedDraft<T>(identity: string, stored: T, write: (value: T) => void, delayMs: number): DebouncedDraft<T> {
  const [draft, setDraft] = useState(stored);
  const [seed, setSeed] = useState({ identity, stored });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  if (seed.identity !== identity || (pending.current === null && seed.stored !== stored)) {
    setSeed({ identity, stored });
    setDraft(stored);
  }

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const held = pending.current;
    pending.current = null;
    if (held !== null) write(held.value);
  }, [write]);

  // Leaving with a write pending must not lose it: it lands on what it was typed against.
  useEffect(() => flush, [flush]);

  const change = useCallback((next: T) => {
    setDraft(next);
    pending.current = { value: next };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delayMs);
  }, [flush, delayMs]);

  return { draft, change, flush };
}
