import type { FootageFit } from '@tscaps/engine/advanced';

/** What fills a box around an asset fitted inside it: black, or the asset itself, blurred. */
export type ShotLayerBackdrop = 'black' | 'blur';

/**
 * Where an asset filling a box of another shape sits in it, on each
 * axis a share of the part cropped away: `0` keeps the left (or top)
 * edge, `0.5` the centre, `1` the right (or bottom) edge.
 */
export interface ShotLayerPicturePosition {
  readonly x: number;
  readonly y: number;
}

/** The asset covers the whole frame; the video is hidden beneath it. */
export interface FullShotLayerPlacement {
  readonly kind: 'full';
  readonly fit: FootageFit;
  /** What fills the box around the asset where it is fitted inside it; nothing, so what is beneath shows, where unset. */
  readonly backdrop?: ShotLayerBackdrop;
  /** Where a filled asset is cropped; centred where unset. */
  readonly position?: ShotLayerPicturePosition;
}

/**
 * The frame cut in two across its long side — top and bottom on a
 * vertical or square frame, left and right on a horizontal one. The
 * asset fills one part, the video is re-framed to cover the other.
 */
export interface SplitShotLayerPlacement {
  readonly kind: 'split';
  /** The part the asset takes: `start` is the top (vertical) or the left (horizontal). */
  readonly assetSide: 'start' | 'end';
  /** The share of the frame's long side the asset's part takes. */
  readonly assetRatio: number;
  /** A margin around the asset inside its part, as a fraction of the frame's shorter side. */
  readonly padding: number;
  /** As a fraction of the frame's shorter side. */
  readonly cornerRadius: number;
  readonly fit: FootageFit;
  /** What fills the box around the asset where it is fitted inside it; nothing, so what is beneath shows, where unset. */
  readonly backdrop?: ShotLayerBackdrop;
  /** Where a filled asset is cropped; centred where unset. */
  readonly position?: ShotLayerPicturePosition;
}

/**
 * A box floating over the frame. Either the asset floats in it, over the
 * video, which stays as it is underneath; or the video floats in it, over
 * the asset, which then fills the frame.
 */
export interface InsetShotLayerPlacement {
  readonly kind: 'inset';
  /** What floats in the box: the asset, or the video. */
  readonly subject: 'asset' | 'video';
  /** The box's centre, normalized to the frame (0 = left / top, 1 = right / bottom). */
  readonly centerX: number;
  readonly centerY: number;
  /** The box's width, as a fraction of the frame's width. */
  readonly width: number;
  /** The box's width over its height, or null for the shape of what floats in it: the asset's, or the video's. */
  readonly aspectRatio: number | null;
  /**
   * The least distance kept between the box and the frame's edges, as a
   * fraction of the frame's shorter side. A box that would not fit is
   * shrunk; one that would cross it is pushed back inside.
   */
  readonly padding: number;
  /** As a fraction of the frame's shorter side. */
  readonly cornerRadius: number;
  readonly fit: FootageFit;
  /** What fills the box around the asset where it is fitted inside it; nothing, so what is beneath shows, where unset. */
  readonly backdrop?: ShotLayerBackdrop;
  /** Where a filled asset is cropped; centred where unset. */
  readonly position?: ShotLayerPicturePosition;
}

/** How a shot layer sits in the frame: one of a few named layouts. */
export type ShotLayerPlacement = FullShotLayerPlacement | SplitShotLayerPlacement | InsetShotLayerPlacement;

export type ShotLayerPlacementKind = ShotLayerPlacement['kind'];
