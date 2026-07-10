/**
 * Whether a style participates in the "text-behind-actor" rendering
 * primitive: the caption is rasterised as usual, and the consumer paints
 * an actor cutout layer on top at composition time so the actor visually
 * covers the caption. The engine exposes the state variables and the
 * baseline CSS that resolves the final `--behind-actor-active` decision;
 * the consumer supplies the cutout pixels outside the caption HTML.
 */
export interface BehindActorRequirement {
  readonly required: boolean;
}
