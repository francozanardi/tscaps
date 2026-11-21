import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/** One output frame's caption: the time it lands on and the video frame under it. */
export interface SubtitleLayerRequest {
  /** Presentation timestamp of `videoFrame` in seconds. */
  readonly time: number;
  readonly videoFrame: DecodedVideoFrame;
}

/**
 * Produces caption rasters for a render, a run of frames at a time.
 *
 * Lifecycle is per-render: {@link open} prepares the source for a
 * specific document and style set, {@link framesFor} services runs of
 * frames in monotonically advancing time order — or in any order, for
 * an implementation that says it serves one — and {@link close}
 * releases the underlying resources. Open/close pairs may repeat
 * against the same instance, but a source cannot serve two renders
 * concurrently.
 */
export interface SubtitleLayerSource {
  /**
   * Prepares the source for a render at the given dimensions, scoped
   * to `styles` keyed by `Section.kind`.
   *
   * @param captionInterval Seconds between successive caption ticks.
   */
  open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    captionInterval: number,
  ): Promise<void>;

  /**
   * How many consecutive requests the source wants in one call to work
   * at its best. `1` means it can answer frame by frame; a larger
   * number means it amortizes work across a run and the caller should
   * gather that many before asking. It is a preference, not a
   * requirement: a call with fewer is always valid, and the last run of
   * a render is short by nature.
   *
   * Meaningful only after {@link open}.
   */
  lookAhead(): number;

  /**
   * Resolves to one raster per request, in the order given, with
   * `null` wherever no Section served by this source is active.
   *
   * The rasters are owned by the source and stay valid only until the
   * next {@link framesFor} call or until {@link close}.
   */
  framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>>;

  close(): void;
}
