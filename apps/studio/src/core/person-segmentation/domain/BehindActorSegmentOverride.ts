/**
 * Per-segment override the user chooses to short-circuit the detector:
 *  - `auto`: use the detector's verdict as computed from the valid
 *    windows.
 *  - `force-on`: apply the effect regardless of the detector, even in
 *    segments where the detector would have said no.
 *  - `force-off`: skip the effect even when the detector would have
 *    said yes.
 */
export type BehindActorSegmentOverride = 'auto' | 'force-on' | 'force-off';
