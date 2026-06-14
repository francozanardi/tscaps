import { useEffect, useState } from 'react';

/**
 * Reactive boolean that tracks whether the Alt (Option on macOS) key
 * is currently held. Updates synchronously on `keydown` and `keyup`
 * and falls back to `false` whenever the window loses focus, so the
 * value can't latch on if the user releases the key while focused
 * elsewhere (e.g. after a tab away).
 */
export function useAltKeyHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Alt') setHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Alt') setHeld(false);
    };
    const onBlur = (): void => setHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  return held;
}
