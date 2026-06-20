/**
 * Class on the element the renderer emits inside a Segment when its
 * `RenderingConfig.videoFrame.required` is set. The Section's
 * stylesheet targets this class to position, clip, or filter the
 * video frame.
 */
export const VIDEO_FRAME_LAYER_CLASS = 'tscaps-video-frame-layer';

/**
 * Default rule for {@link VIDEO_FRAME_LAYER_CLASS}: positions the
 * layer over the subtitle's painted region via the
 * `--subtitle-region-*` custom properties and paints the current
 * frame slice from `--video-frame`. Class-level specificity so
 * sheet-scoped overrides always win.
 *
 * `max-width: none; max-height: none` defeats consumer CSS resets
 * (e.g. Tailwind's `img, video { max-width: 100% }`) that would
 * clip the layer to its content-hugging segment parent and break
 * the region geometry.
 */
export const VIDEO_FRAME_LAYER_BASELINE_CSS = `.${VIDEO_FRAME_LAYER_CLASS} { position: absolute; left: var(--subtitle-region-x, 0); top: var(--subtitle-region-y, 0); width: var(--subtitle-region-width, 100%); height: var(--subtitle-region-height, 100%); max-width: none; max-height: none; background-image: var(--video-frame, none); background-size: 100% 100%; pointer-events: none; object-fit: fill; }`;
