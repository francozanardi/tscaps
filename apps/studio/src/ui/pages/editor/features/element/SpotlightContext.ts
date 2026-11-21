import { createContext, useContext } from 'react';

/**
 * The part of a panel waiting to be shown to the user, by the key it is
 * registered under ({@link useSpotlightTarget}), and the way to say it
 * was shown. Provided by whatever opened the panel on it: the element
 * inspector, or a popover opened from elsewhere.
 */
export interface SpotlightRequest {
  /** The key of the part waiting to be shown, or null. */
  readonly key: string | null;
  /** Says the part was shown, so a later visit does not show it again. */
  spotlit(): void;
}

export const SpotlightContext = createContext<SpotlightRequest>({ key: null, spotlit: () => {} });

/** The part of the panel waiting to be shown; none outside a provider. */
export function useSpotlightRequest(): SpotlightRequest {
  return useContext(SpotlightContext);
}
