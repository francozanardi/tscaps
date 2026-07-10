import { useBeforeUnloadIfDirty } from '@ui/_shared/hooks/useBeforeUnloadIfDirty';

/**
 * Installs the unsaved-edits leave-page guard at the editor tree's
 * top level. Renders nothing — exists purely to host the hook inside
 * the providers tree.
 */
export function UnsavedChangesGuardInstaller(): null {
  useBeforeUnloadIfDirty();
  return null;
}
