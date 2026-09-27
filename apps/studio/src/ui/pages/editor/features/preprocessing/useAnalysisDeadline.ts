import { useEffect, useRef, useState } from 'react';

/** What the start flow is waiting on before it can offer a start. */
export type AnalysisPhase = 'probing' | 'validating';

/**
 * Reading a container and applying the rules are both meant to be
 * imperceptible. Three seconds is the most a visitor should wait for
 * the right to press a button.
 */
const DEADLINE_MS = 3_000;

/**
 * The phase the flow was in when it ran out of time, or `null` while
 * it is still within budget or has nothing to wait on.
 *
 * One budget covers the whole wait rather than one per phase: what is
 * being bounded is how long the visitor sits there, and they do not
 * care which of our steps spent it.
 */
export function useAnalysisDeadline(phase: AnalysisPhase | null): AnalysisPhase | null {
  const [exceeded, setExceeded] = useState<AnalysisPhase | null>(null);
  const current = useRef<AnalysisPhase | null>(phase);
  current.current = phase;
  const waiting = phase !== null;

  useEffect(() => {
    setExceeded(null);
    if (!waiting) return;
    const timer = window.setTimeout(() => setExceeded(current.current), DEADLINE_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  return exceeded;
}
