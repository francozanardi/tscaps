import type {
  InsetShotLayerPlacement,
  ShotLayerPlacement,
  ShotLayerPlacementKind,
} from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import type { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';

export type ShotLayerAspectPreset = 'original' | '1:1' | '4:5' | '9:16' | '16:9';

/** Where across the frame a box can be put: against the left edge, in the centre, against the right edge. */
export type ShotLayerHorizontalAnchor = 'left' | 'center' | 'right';
/** Where down the frame a box can be put: against the top edge, in the middle, against the bottom edge. */
export type ShotLayerVerticalAnchor = 'top' | 'center' | 'bottom';

/** What each end of a split is called on a given frame. */
export interface ShotLayerSplitSideLabels {
  readonly start: string;
  readonly end: string;
}

const LAYOUT_LABELS: Record<ShotLayerPlacementKind, string> = {
  full: 'Full screen',
  split: 'Split screen',
  inset: 'Picture in picture',
};

const LAYOUT_KINDS: ReadonlyArray<ShotLayerPlacementKind> = ['full', 'split', 'inset'];

const ASPECT_PRESETS: ReadonlyArray<ShotLayerAspectPreset> = ['original', '1:1', '4:5', '9:16', '16:9'];

const ASPECT_PRESET_LABELS: Record<ShotLayerAspectPreset, string> = {
  original: 'Original',
  '1:1': 'Square (1:1)',
  '4:5': 'Portrait (4:5)',
  '9:16': 'Vertical (9:16)',
  '16:9': 'Wide (16:9)',
};

const ASPECT_RATIO_BY_PRESET: Record<Exclude<ShotLayerAspectPreset, 'original'>, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
};

// A stored setting is a float that has been through JSON; this is far
// tighter than any two presets or anchors are apart.
const MATCH_TOLERANCE = 1e-3;

const HORIZONTAL_ANCHORS: ReadonlyArray<ShotLayerHorizontalAnchor> = ['left', 'center', 'right'];
const VERTICAL_ANCHORS: ReadonlyArray<ShotLayerVerticalAnchor> = ['top', 'center', 'bottom'];

const HORIZONTAL_CENTERS: Record<ShotLayerHorizontalAnchor, number> = { left: 0, center: 0.5, right: 1 };
const VERTICAL_CENTERS: Record<ShotLayerVerticalAnchor, number> = { top: 0, center: 0.5, bottom: 1 };

const HORIZONTAL_ANCHOR_LABELS: Record<ShotLayerHorizontalAnchor, string> = { left: 'Left', center: 'Centre', right: 'Right' };
const VERTICAL_ANCHOR_LABELS: Record<ShotLayerVerticalAnchor, string> = { top: 'Top', center: 'Middle', bottom: 'Bottom' };

/**
 * The settings a placement is offered by, and the way back from each to
 * the placement it writes: which layout, which of a few box shapes,
 * which of three places across the frame and three down it.
 *
 * A placement the settings cannot describe — a box dragged somewhere, a
 * shape no preset names — reads as none of them, and nothing is changed
 * until the reader picks one. The two axes are read apart: a box dragged
 * down an edge still reads as against that edge.
 */
export class ShotLayerPlacementForm {
  constructor(
    private readonly sanitizer: ShotLayerPlacementSanitizer,
    private readonly boxShape: ShotLayerBoxShape,
  ) {}

  /** The layouts in the order they are offered. */
  layouts(): ReadonlyArray<ShotLayerPlacementKind> {
    return LAYOUT_KINDS;
  }

  /** The layout's name as the reader sees it. */
  layoutLabel(kind: ShotLayerPlacementKind): string {
    return LAYOUT_LABELS[kind];
  }

  /**
   * `current` moved to the `kind` layout: unchanged when it already is
   * one, and otherwise that layout's fresh settings, keeping how the
   * asset fills its box, which every layout has.
   */
  withLayout(current: ShotLayerPlacement, kind: ShotLayerPlacementKind): ShotLayerPlacement {
    if (current.kind === kind) return current;
    return {
      ...this.sanitizer.fresh(kind),
      fit: current.fit,
      ...(current.backdrop === undefined ? {} : { backdrop: current.backdrop }),
      ...(current.position === undefined ? {} : { position: current.position }),
    };
  }

  /** The shapes a box can be given, in the order they are offered. */
  aspectPresets(): ReadonlyArray<ShotLayerAspectPreset> {
    return ASPECT_PRESETS;
  }

  /** The shape's name as the reader sees it. */
  aspectPresetLabel(preset: ShotLayerAspectPreset): string {
    return ASPECT_PRESET_LABELS[preset];
  }

  /** The preset `placement`'s box shape is, or null when it matches none of them. */
  aspectPresetOf(placement: InsetShotLayerPlacement): ShotLayerAspectPreset | null {
    if (placement.aspectRatio === null) return 'original';
    for (const [preset, ratio] of Object.entries(ASPECT_RATIO_BY_PRESET)) {
      if (Math.abs(ratio - placement.aspectRatio) < MATCH_TOLERANCE) return preset as ShotLayerAspectPreset;
    }
    return null;
  }

  withAspectPreset(placement: InsetShotLayerPlacement, preset: ShotLayerAspectPreset): InsetShotLayerPlacement {
    const aspectRatio = preset === 'original' ? null : ASPECT_RATIO_BY_PRESET[preset];
    return { ...placement, aspectRatio };
  }

  /** The places across the frame a box can be put, left to right. */
  horizontalAnchors(): ReadonlyArray<ShotLayerHorizontalAnchor> {
    return HORIZONTAL_ANCHORS;
  }

  /** The places down the frame a box can be put, top to bottom. */
  verticalAnchors(): ReadonlyArray<ShotLayerVerticalAnchor> {
    return VERTICAL_ANCHORS;
  }

  /**
   * Where across the frame `placement`'s box is put, or null when its
   * centre is anywhere else. A box at an edge is held inside the padding
   * where it is drawn, so the anchor names the edge rather than a point
   * half a box outside it.
   */
  horizontalAnchorOf(placement: InsetShotLayerPlacement): ShotLayerHorizontalAnchor | null {
    return this.keyOf(HORIZONTAL_CENTERS, placement.centerX);
  }

  /** Where down the frame `placement`'s box is put, or null when its centre is anywhere else. */
  verticalAnchorOf(placement: InsetShotLayerPlacement): ShotLayerVerticalAnchor | null {
    return this.keyOf(VERTICAL_CENTERS, placement.centerY);
  }

  /** The place's name as the reader sees it: "Left", "Centre", "Right". */
  horizontalAnchorLabel(anchor: ShotLayerHorizontalAnchor): string {
    return HORIZONTAL_ANCHOR_LABELS[anchor];
  }

  /** The place's name as the reader sees it: "Top", "Middle", "Bottom". */
  verticalAnchorLabel(anchor: ShotLayerVerticalAnchor): string {
    return VERTICAL_ANCHOR_LABELS[anchor];
  }

  /** `placement`'s box moved across the frame to `anchor`; where it is down the frame is kept. */
  withHorizontalAnchor(placement: InsetShotLayerPlacement, anchor: ShotLayerHorizontalAnchor): InsetShotLayerPlacement {
    return { ...placement, centerX: HORIZONTAL_CENTERS[anchor] };
  }

  /** `placement`'s box moved down the frame to `anchor`; where it is across the frame is kept. */
  withVerticalAnchor(placement: InsetShotLayerPlacement, anchor: ShotLayerVerticalAnchor): InsetShotLayerPlacement {
    return { ...placement, centerY: VERTICAL_CENTERS[anchor] };
  }

  /**
   * What the two ends of a split are called on a frame of
   * `frameAspectRatio` (null when not known): left and right on a frame
   * wider than it is tall, where a split cuts it across, and top and
   * bottom on any other.
   */
  splitSideLabels(frameAspectRatio: number | null): ShotLayerSplitSideLabels {
    const cutsAcross = frameAspectRatio !== null && frameAspectRatio > 1;
    return cutsAcross ? { start: 'Left', end: 'Right' } : { start: 'Top', end: 'Bottom' };
  }

  /** A setting held as a fraction, as the percentage a control shows, to a tenth. */
  percentOf(fraction: number): number {
    return Math.round(fraction * 1000) / 10;
  }

  /** The fraction a percentage a control was set to stands for. */
  fractionOf(percent: number): number {
    return percent / 100;
  }

  /** An asset's width over its height, from its size in pixels; null when either side is not known. */
  aspectRatioOf(widthPx: number | null, heightPx: number | null): number | null {
    return widthPx !== null && heightPx !== null && widthPx > 0 && heightPx > 0 ? widthPx / heightPx : null;
  }

  /** `placement` without where its file is cropped: what a switch to fitting it leaves. */
  withoutCrop(placement: ShotLayerPlacement): ShotLayerPlacement {
    if (placement.position === undefined) return placement;
    const { position: _crop, ...rest } = placement;
    return rest;
  }

  /** `placement` without what fills its box around the file: what a switch to filling the box leaves. */
  withoutBackdrop(placement: ShotLayerPlacement): ShotLayerPlacement {
    if (placement.backdrop === undefined) return placement;
    const { backdrop: _fill, ...rest } = placement;
    return rest;
  }

  /** The axis a file filling its box is cropped on, as {@link ShotLayerBoxShape.croppedAxisOf} reads it. */
  croppedAxisOf(placement: ShotLayerPlacement, frameAspectRatio: number | null, assetAspectRatio: number | null): 'x' | 'y' | null {
    return this.boxShape.croppedAxisOf(placement, frameAspectRatio, assetAspectRatio);
  }

  /** The width over the height of the box `placement` puts its file in, as {@link ShotLayerBoxShape.aspectRatioOf} reads it. */
  boxAspectRatioOf(placement: ShotLayerPlacement, frameAspectRatio: number | null, assetAspectRatio: number | null): number | null {
    return this.boxShape.aspectRatioOf(placement, frameAspectRatio, assetAspectRatio);
  }

  private keyOf<Key extends string>(centers: Record<Key, number>, value: number): Key | null {
    for (const [key, center] of Object.entries(centers) as Array<[Key, number]>) {
      if (Math.abs(center - value) < MATCH_TOLERANCE) return key;
    }
    return null;
  }
}
