import { createContext, useContext } from 'react';

/** The inspector's tab switch, for a panel that points to what another tab holds. */
export interface ElementInspectorTabNav {
  /**
   * Opens the tab `value`. With `spotlight`, the part of that tab
   * registered under that key (`useSpotlightTarget`) is shown once as it
   * opens, so the eye lands on it.
   */
  show(value: string, spotlight?: string): void;
}

export const ElementInspectorTabNavContext = createContext<ElementInspectorTabNav>({
  show: () => {},
});

/** The inspector's tab switch; a no-op outside one. */
export function useElementInspectorTabNav(): ElementInspectorTabNav {
  return useContext(ElementInspectorTabNavContext);
}
