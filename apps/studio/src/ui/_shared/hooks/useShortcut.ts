import { useEffect, useRef } from 'react';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';
import type { ShortcutHandler } from '@presentation/shortcuts/controllers/ShortcutDispatcher';
import { useShortcutDispatcher } from '@ui/_shared/contexts/ShortcutDispatcherContext';

/**
 * Carries out a command with `handler` for as long as the component is
 * mounted and `enabled` holds. The latest `handler` is the one that
 * runs, so it can close over fresh props without rebinding.
 */
export function useShortcut(commandId: ShortcutCommandId, handler: ShortcutHandler, enabled: boolean = true): void {
  const dispatcher = useShortcutDispatcher();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    return dispatcher.bind(commandId, () => handlerRef.current());
  }, [dispatcher, commandId, enabled]);
}
