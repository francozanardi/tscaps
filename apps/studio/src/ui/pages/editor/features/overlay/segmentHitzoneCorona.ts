/**
 * How far past its content box a caption can be clicked, in px. The
 * selection outline is drawn with the same reach (`inset: -22px -32px`
 * in `SubtitleOverlay.css`), so the rectangle a person sees around a
 * caption is the one that answers a click.
 */
export const SEGMENT_HITZONE_CORONA = { horizontalPx: 32, verticalPx: 22 } as const;
