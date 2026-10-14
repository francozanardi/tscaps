import { createContext } from 'react';

/**
 * The z-index class a floating element (a popover) must take to show
 * above the dialog it was opened from. `null` outside any dialog, where
 * the floating element keeps its own.
 *
 * Floating elements portal to the document body, so they never inherit
 * the dialog's stacking: without this, one opened from inside a dialog
 * renders behind the dialog's overlay and cannot be reached.
 */
export const FloatingLayerContext = createContext<string | null>(null);
