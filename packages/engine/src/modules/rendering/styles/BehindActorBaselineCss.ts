/**
 * Baseline CSS for the "text-behind-actor" primitive. Publishes
 * `--behind-actor-active` on `.segment` as the final decision the
 * consumer inspects when compositing the actor cutout layer.
 *
 * The baseline resolves `active` from `--behind-actor-forced` alone,
 * so a user-driven force-on works even on styles whose stylesheets do
 * not participate in the feature. Styles that opt in override this
 * rule to also fall back to `--behind-actor-scene-valid` (with any
 * additional selectors they want), giving them the auto-detected
 * activation on top of the force-on baseline.
 *
 * The consumer sets `--behind-actor-scene-valid: 1` and/or
 * `--behind-actor-forced: 1` on the segment's inline style only when
 * true; unset means false. `--behind-actor-active` resolves to `1`
 * when either input is present.
 */
export const BEHIND_ACTOR_BASELINE_CSS = `.segment { --behind-actor-active: var(--behind-actor-forced, 0); }`;
