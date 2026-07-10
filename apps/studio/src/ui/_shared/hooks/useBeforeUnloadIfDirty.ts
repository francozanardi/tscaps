import { useEffect } from 'react';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';

/**
 * Attaches a `beforeunload` listener that triggers the browser's
 * native "Leave site?" confirmation whenever closing the tab right
 * now would lose work. The decision is delegated to the projects
 * module's `unsavedWorkPolicy` and is evaluated at fire time, so no
 * re-attach is needed when underlying state changes.
 */
export function useBeforeUnloadIfDirty(): void {
  const { unsavedWorkPolicy } = useProjects();

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsavedWorkPolicy.shouldWarnBeforeLeave()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsavedWorkPolicy]);
}
