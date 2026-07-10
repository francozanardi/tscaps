import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';
import type { UserTemplatesModule } from '@bootstrap/wiring/user-templates';
import type { SaveUserTemplateInput } from '@core/user-templates/actions/SaveUserTemplateAction';

/**
 * UI-facing handle for the user-saved templates feature: the live
 * list (subscribed via `useSyncExternalStore`), the save/delete
 * callbacks, and the name validator so dialogs can give live feedback
 * without duplicating the rules.
 */
export interface UserTemplatesContextValue {
  userTemplates: readonly UserTemplate[];
  save: (input: SaveUserTemplateInput) => Promise<UserTemplate>;
  delete: (id: string) => Promise<void>;
  rename: (id: string, newName: string) => Promise<UserTemplate>;
  overwrite: (id: string, sheet: Sheet) => Promise<UserTemplate>;
  validateName: (raw: string) => string | null;
  nameMaxLength: number;
}

const UserTemplatesContext = createContext<UserTemplatesContextValue | null>(null);

interface UserTemplatesProviderProps {
  value: UserTemplatesModule;
  children: ReactNode;
}

export function UserTemplatesProvider({ value, children }: UserTemplatesProviderProps) {
  const persisted = useSyncExternalStore(
    (cb) => {
      value.store.addEventListener('change', cb);
      return () => value.store.removeEventListener('change', cb);
    },
    () => value.store.snapshot(),
  );
  // Hide saved templates that can't render in this browser — same rule
  // already applied to built-ins via `FilteredTemplateRepository`. The
  // entries stay in storage; only the picker view is filtered.
  const userTemplates = useMemo<readonly UserTemplate[]>(
    () => persisted.filter((entry) => value.templateSupportChecker.isSupported(entry.template)),
    [persisted, value.templateSupportChecker],
  );
  return (
    <UserTemplatesContext.Provider
      value={{
        userTemplates,
        save: (input) => value.actions.save.execute(input),
        delete: (id) => value.actions.delete.execute(id),
        rename: (id, newName) => value.actions.rename.execute(id, newName),
        overwrite: (id, sheet) => value.actions.overwrite.execute(id, sheet),
        validateName: (raw) => value.nameValidator.validate(raw),
        nameMaxLength: value.nameValidator.maxLength,
      }}
    >
      {children}
    </UserTemplatesContext.Provider>
  );
}

/**
 * Returns the user-templates context. Throws if the consumer is
 * mounted outside `<UserTemplatesProvider>`; that is always a wiring
 * bug and should surface loudly rather than fall back to a stale or
 * partial surface.
 */
export function useUserTemplates(): UserTemplatesContextValue {
  const value = useContext(UserTemplatesContext);
  if (!value) throw new Error('useUserTemplates must be used inside <UserTemplatesProvider>');
  return value;
}
