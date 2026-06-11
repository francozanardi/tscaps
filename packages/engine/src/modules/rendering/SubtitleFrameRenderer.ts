import type { Document } from '@modules/document/Document';
import type { AlignmentConfig } from '@modules/rendering/AlignmentConfig';
import type { RenderingConfig } from '@modules/rendering/RenderingConfig';
import type { ElementRenderOverrides } from '@modules/rendering/ElementRenderOverrides';
import type { InlineStyleMap } from '@modules/rendering/InlineStyleMap';
import type { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import type { VideoFrameSource } from '@modules/rendering/VideoFrameSource';

/**
 * The render-time configuration for one Section.kind: the stylesheet
 * that defines its visual rules, the root-level inline styles that
 * seed it, where the rendered subtitle anchors inside the video frame,
 * the structural rendering switches the stylesheet was authored
 * against, and optional per-segment / per-word overrides.
 *
 * The renderer dispatches per active Section using `Section.kind` as
 * the lookup key into the `styles` map supplied to `open`.
 */
export interface SubtitleStyle {
  /** Stylesheet defining the visual rules for this kind. */
  css: string;
  /** Root-level inline styles applied on the wrapper: CSS custom properties consumed by `css`, plus any direct property defaults. Per-segment and per-word overrides layer on top. */
  inlineStyles: InlineStyleMap;
  /** Where the rendered subtitle anchors inside the video frame. Per-segment and per-word `alignment` overrides merge over this. */
  alignment: AlignmentConfig;
  /** Structural switches the stylesheet was authored against (e.g. letter-level split). */
  rendering: RenderingConfig;
  /** Per-segment overrides, keyed by `Segment.id`. */
  segmentOverrides?: ElementRenderOverrides;
  /** Per-word overrides, keyed by `Word.id`. */
  wordOverrides?: ElementRenderOverrides;
  /** `<filter>` defs the stylesheet references via `filter: url(#id)`, paired with the scope that materializes them. */
  svgFilters?: SvgFilterBundle;
}

/**
 * A drawable handle for one rendered subtitle frame. The consumer
 * paints it into its own 2D context through `draw`.
 *
 * The underlying raster is owned by the renderer that produced this
 * frame and stays valid only until the next `getFrames` call on the
 * same renderer or until `close`. Holding a `SubtitleFrame` past
 * either event leaves `draw` painting whatever state has since
 * replaced the raster.
 */
export interface SubtitleFrame {
  /**
   * Paints the frame into `context` at `(dx, dy)` scaled to
   * `dWidth × dHeight`. The source rectangle is the full frame.
   */
  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
}

/**
 * Produces drawable subtitle frames for a given Document.
 *
 * Usage:
 *   1. `open` once per document.
 *   2. Either `getFrames(timestamps)` per batch (with at most
 *      `getMaxBatchSize()` entries), or `getFrame(timestamp)` per
 *      individual timestamp.
 *   3. `close` when done.
 */
export interface SubtitleFrameRenderer {
  /**
   * Prepares the renderer for `doc` and the set of styles its
   * Sections may reference. `styles` is keyed by `Section.kind`.
   * Must complete before the first `getFrames`/`getFrame` call.
   *
   * `videoFrameSource` is required when any style in `styles` has
   * `rendering.videoFrame.required` set, and may be omitted
   * otherwise. Throws if a style requires the frame but no source
   * is supplied.
   */
  open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    videoFrameSource?: VideoFrameSource,
  ): Promise<void>;

  /**
   * Maximum number of timestamps a single `getFrames` call accepts
   * at the given output dimensions. Bounded by the renderer's memory
   * budget and any platform raster-size caps. A caller that exceeds
   * this may see the call fail outright.
   */
  getMaxBatchSize(): Promise<number>;

  /**
   * Renders subtitle frames for the given timestamps. The returned
   * array has the same length and order as `timestamps`; an entry is
   * `null` for timestamps where no Section is active.
   *
   * The implementation may deduplicate internally: timestamps that
   * hit the same visual state share a single raster tile inside the
   * batch and their return entries point at the same tile.
   *
   * Frames produced by one call may share underlying raster
   * resources; those resources stay valid until the next
   * `getFrames`/`getFrame` call or until `close`.
   */
  getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>>;

  /**
   * Renders the subtitle frame for a single timestamp. Returns
   * `null` when no Section is active at `timestamp`. Equivalent in
   * result to `(await getFrames([timestamp]))[0]`.
   *
   * The returned frame's underlying raster follows the same
   * lifetime as `getFrames` results: valid until the next
   * `getFrames`/`getFrame` call or until `close`.
   */
  getFrame(timestamp: number): Promise<SubtitleFrame | null>;

  /**
   * Releases any host-document state the renderer attached during
   * `open` (probe stylesheets, offscreen containers). After `close`,
   * `getFrames`/`getFrame` return `null` for every timestamp.
   */
  close(): void;
}
