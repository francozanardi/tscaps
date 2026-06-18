import { CssVariable } from '@modules/document/CssVariable';

/** Default factor `font-size` of `.word-decoration` scales by, relative to its inherited size. Consumers override per sheet by setting `CssVariable.DECORATION_FONT_SIZE_MULTIPLIER` on the host node. */
export const DECORATION_FONT_SIZE_MULTIPLIER = 1.8;

/** Default factor applied to the per-side base spacing between a decoration and its anchor. Consumers override per sheet by setting `CssVariable.DECORATION_GAP_MULTIPLIER` on the host node. */
export const DECORATION_GAP_MULTIPLIER = 0.1;

/** Baseline CSS for `.word-decoration` glyphs and the `.segment-decorations-above` / `.segment-decorations-below` containers. Inject ahead of any per-style stylesheet. */
export const DECORATION_CONTAINER_BASELINE_CSS = `
.segment { position: relative; }
.word-decoration {
  display: inline-block;
  font-size: calc(1em * var(${CssVariable.DECORATION_FONT_SIZE_MULTIPLIER}, ${DECORATION_FONT_SIZE_MULTIPLIER}));
}
.word > .word-decoration {
  margin-left: calc(0.25em * var(${CssVariable.DECORATION_GAP_MULTIPLIER}, ${DECORATION_GAP_MULTIPLIER}));
}
.segment-decorations-above,
.segment-decorations-below {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 0.5em;
  pointer-events: auto;
}
.segment-decorations-above {
  bottom: calc(100% - var(${CssVariable.SEGMENT_PADDING_TOP}, 0px));
  margin-bottom: calc(0.4em * var(${CssVariable.DECORATION_GAP_MULTIPLIER}, ${DECORATION_GAP_MULTIPLIER}));
}
.segment-decorations-below {
  top: calc(100% - var(${CssVariable.SEGMENT_PADDING_BOTTOM}, 0px));
  margin-top: calc(0.4em * var(${CssVariable.DECORATION_GAP_MULTIPLIER}, ${DECORATION_GAP_MULTIPLIER}));
}
`;
