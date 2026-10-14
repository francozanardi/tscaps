/**
 * What the user chose for whether one element hides behind the actor,
 * short-circuiting the detector:
 *  - `auto`: use the detector's verdict as computed from the valid
 *    windows. Only a scene has one; anything inside a scene is off on
 *    `auto`.
 *  - `force-on`: apply the effect regardless of the detector, even where
 *    the detector would have said no.
 *  - `force-off`: skip the effect even when the detector would have
 *    said yes.
 */
export type BehindActorOverride = 'auto' | 'force-on' | 'force-off';
