import type { Document } from '@modules/document/Document';
import type { AlignmentConfig } from '@modules/rendering/types/AlignmentConfig';
import type { RenderingConfig } from '@modules/rendering/types/RenderingConfig';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import type { VideoFrameSource } from '@modules/rendering/types/VideoFrameSource';

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
  /** Overrides for the elements inside a segment — its lines, its words, and the glyphs attached to them — keyed by element id. */
  subtreeOverrides?: ElementRenderOverrides;
  /** `<filter>` defs the stylesheet references via `filter: url(#id)`, paired with the scope that materializes them. */
  svgFilters?: SvgFilterBundle;
  /** Decorations lifted out of line flow, keyed by decoration id. Decorations absent from the map render inline next to their host word. */
  decorationPlacements?: ReadonlyMap<string, DecorationPlacementSide>;
  /** Ids of elements `css` addresses individually, so the renderer stamps `DataAttribute.ELEMENT_ID` on them. Any element id qualifies — segment, line, word or decoration. Omit when the stylesheet addresses only classes. */
  addressableElementIds?: ReadonlySet<string>;
}

/**
 * A drawable handle for one rendered subtitle frame. The consumer
 * paints it into its own 2D context through `draw`.
 *
 * The underlying raster belongs to the **batch** that produced this
 * frame rather than to the renderer, and stays valid until `close`.
 * Frames from separate batches can therefore be held and painted
 * alongside each other.
 *
 * That is load-bearing, not incidental: a caller gathers a run of
 * frames before it paints any of them, and a run can span a batch
 * boundary. An implementation that recycled one surface across
 * batches would leave every frame but the last painting a raster that
 * has since been overwritten — silently, and only for the runs that
 * happen to straddle the boundary.
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
 *   2. `getFrames(timestamps)` per batch, advancing by the length of
 *      what it returns.
 *   3. `close` when done.
 */
export interface SubtitleFrameRenderer {
  /**
   * Prepares the renderer for `doc` and the set of styles its
   * Sections may reference. `styles` is keyed by `Section.kind`.
   * Must complete before the first `getFrames` call.
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
   * How many distinct pictures one batch can rasterize at the given
   * output dimensions, bounded by the renderer's memory budget and by
   * any platform raster-size caps.
   *
   * This is a count of pictures, not of timestamps: timestamps that
   * paint the same thing share one, so a batch covers as much video as
   * the captions hold still for. Offer `getFrames` as many timestamps
   * as you are willing to look ahead and let it answer how far it
   * reached.
   */
  getMaxTilesPerBatch(): Promise<number>;

  /**
   * Renders subtitle frames for the given timestamps, in order. An
   * entry is `null` for a timestamp where no Section is active.
   *
   * The returned array covers a **prefix** of `timestamps`: the batch
   * ends where the pictures it holds run out of room, so ask for as
   * many as you want to look ahead, take what comes back, and start
   * the next call where this one stopped. It is never empty for a
   * non-empty input, so a caller advancing by its length always makes
   * progress. Asking for at most `getMaxTilesPerBatch()` timestamps
   * always comes back whole, since no batch can need more pictures
   * than it has timestamps.
   *
   * The implementation deduplicates internally: timestamps that hit
   * the same visual state share a single raster tile inside the batch
   * and their return entries point at the same tile.
   *
   * Frames produced by one call may share underlying raster
   * resources, and those resources belong to the call rather than to
   * the renderer: a later `getFrames` does not disturb them.
   */
  getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>>;

  /**
   * Releases any host-document state the renderer attached during
   * `open` (probe stylesheets, offscreen containers). After `close`,
   * `getFrames` returns `null` for every timestamp.
   */
  close(): void;
}
