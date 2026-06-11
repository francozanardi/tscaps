/**
 * Decides whether closing the tab right now would lose work the user
 * could otherwise keep. Implementations combine whatever signals are
 * relevant to them (dirty flags, in-flight operations, session state).
 */
export interface UnsavedWorkPolicy {
  shouldWarnBeforeLeave(): boolean;
}
