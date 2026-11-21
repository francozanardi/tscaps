import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ShotLayerBackdrop, ShotLayerPlacement, ShotLayerPlacementKind } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';

/** A layer's layout as its fields record it: field id to value, holding only the fields its layout reads. */
export type ShotLayerLayoutValues = Readonly<Partial<Record<ElementFieldId, ElementControlValue>>>;

/** Every field a layer's layout is recorded under, in the order they are written. */
export const SHOT_LAYER_LAYOUT_FIELD_IDS: ReadonlyArray<ElementFieldId> = [
  ElementFieldId.LAYOUT,
  ElementFieldId.FIT,
  ElementFieldId.BACKDROP,
  ElementFieldId.CROP_X,
  ElementFieldId.CROP_Y,
  ElementFieldId.CORNER_RADIUS,
  ElementFieldId.PADDING,
  ElementFieldId.SPLIT_SIDE,
  ElementFieldId.SPLIT_RATIO,
  ElementFieldId.CENTER_X,
  ElementFieldId.CENTER_Y,
  ElementFieldId.WIDTH,
  ElementFieldId.ASPECT_RATIO,
  ElementFieldId.INSET_SUBJECT,
];

const LAYOUT_VALUE: Readonly<Record<ShotLayerPlacementKind, string>> = { full: '0', split: '1', inset: '2' };
const KIND_BY_LAYOUT_VALUE: ReadonlyMap<ElementControlValue | undefined, ShotLayerPlacementKind> = new Map([
  ['0', 'full'],
  ['1', 'split'],
  ['2', 'inset'],
]);
const BACKDROP_VALUE: Readonly<Record<ShotLayerBackdrop, string>> = { black: '1', blur: '2' };
const BACKDROP_BY_VALUE: ReadonlyMap<ElementControlValue | undefined, ShotLayerBackdrop> = new Map([
  ['1', 'black'],
  ['2', 'blur'],
]);
const END_SIDE = '1';
const VIDEO_FLOATS = '1';
const ASSET_FLOATS = '0';
const START_SIDE = '0';

/**
 * Reads a layer's layout off the fields it is recorded in, and spells a
 * layout as those fields: the typed view of what a layer's layout fields
 * hold, for the code that edits a layout as a whole — a panel, a drag,
 * a change to several layers at once.
 *
 * Reads the record only, never the CSS the fields wrote. A layer laid
 * out by hand-written CSS still reads as the layout its fields hold.
 *
 * Padding and corners are recorded in hundredths of the frame's shorter
 * side, the unit the declaration is written in, and read back as the
 * fraction the layout holds. Every setting is recorded to four decimals.
 */
export class ShotLayerLayoutFields {
  constructor(private readonly placements: ShotLayerPlacementSanitizer) {}

  /**
   * The layout `values` record, every setting clamped to its range and
   * one that cannot be read taking its layout's fresh value. A layer
   * whose fields name no layout is on the full frame, as the framework
   * draws one.
   */
  placementOf(values: ElementFieldValues | undefined): ShotLayerPlacement {
    const held = values ?? {};
    const kind = KIND_BY_LAYOUT_VALUE.get(held[ElementFieldId.LAYOUT]) ?? 'full';
    return this.placements.sanitize({
      kind,
      fit: held[ElementFieldId.FIT],
      backdrop: BACKDROP_BY_VALUE.get(held[ElementFieldId.BACKDROP]),
      position: { x: held[ElementFieldId.CROP_X], y: held[ElementFieldId.CROP_Y] },
      cornerRadius: this.fractionOf(held[ElementFieldId.CORNER_RADIUS]),
      padding: this.fractionOf(held[ElementFieldId.PADDING]),
      assetSide: held[ElementFieldId.SPLIT_SIDE] === END_SIDE ? 'end' : 'start',
      assetRatio: held[ElementFieldId.SPLIT_RATIO],
      centerX: held[ElementFieldId.CENTER_X],
      centerY: held[ElementFieldId.CENTER_Y],
      width: held[ElementFieldId.WIDTH],
      aspectRatio: held[ElementFieldId.ASPECT_RATIO],
      subject: held[ElementFieldId.INSET_SUBJECT] === VIDEO_FLOATS ? 'video' : 'asset',
    }) ?? this.placements.fresh('full');
  }

  /** The layout `values` record, as {@link placementOf} reads it; null where they name no layout at all. */
  placementNamedBy(values: ElementFieldValues): ShotLayerPlacement | null {
    return KIND_BY_LAYOUT_VALUE.has(values[ElementFieldId.LAYOUT]) ? this.placementOf(values) : null;
  }

  /** The fields `placement` is recorded as: its layout's and no others. An aspect ratio left to the file is no field. */
  valuesOf(placement: ShotLayerPlacement): ShotLayerLayoutValues {
    const common = {
      [ElementFieldId.LAYOUT]: LAYOUT_VALUE[placement.kind],
      [ElementFieldId.FIT]: placement.fit,
      ...(placement.backdrop === undefined ? {} : { [ElementFieldId.BACKDROP]: BACKDROP_VALUE[placement.backdrop] }),
      ...(placement.position === undefined ? {} : {
        [ElementFieldId.CROP_X]: this.rounded(placement.position.x),
        [ElementFieldId.CROP_Y]: this.rounded(placement.position.y),
      }),
    };
    switch (placement.kind) {
      case 'full':
        return common;
      case 'split':
        return {
          ...common,
          [ElementFieldId.CORNER_RADIUS]: this.hundredthsOf(placement.cornerRadius),
          [ElementFieldId.PADDING]: this.hundredthsOf(placement.padding),
          [ElementFieldId.SPLIT_SIDE]: placement.assetSide === 'end' ? END_SIDE : START_SIDE,
          [ElementFieldId.SPLIT_RATIO]: this.rounded(placement.assetRatio),
        };
      case 'inset':
        return {
          ...common,
          [ElementFieldId.CORNER_RADIUS]: this.hundredthsOf(placement.cornerRadius),
          [ElementFieldId.PADDING]: this.hundredthsOf(placement.padding),
          [ElementFieldId.CENTER_X]: this.rounded(placement.centerX),
          [ElementFieldId.CENTER_Y]: this.rounded(placement.centerY),
          [ElementFieldId.WIDTH]: this.rounded(placement.width),
          ...(placement.aspectRatio === null ? {} : { [ElementFieldId.ASPECT_RATIO]: this.rounded(placement.aspectRatio) }),
          [ElementFieldId.INSET_SUBJECT]: placement.subject === 'video' ? VIDEO_FLOATS : ASSET_FLOATS,
        };
    }
  }

  /** Whether two layouts say the same thing. */
  isSame(first: ShotLayerPlacement, second: ShotLayerPlacement): boolean {
    return this.placements.isSame(first, second);
  }

  /** `value` checked and clamped as a stored layout is; null where it names no layout. */
  sanitize(value: unknown): ShotLayerPlacement | null {
    return this.placements.sanitize(value);
  }

  // Without the float noise a multiplication leaves, so a value written and read back is the value given.
  private hundredthsOf(fraction: number): number {
    return Number((fraction * 100).toFixed(4));
  }

  // A ten-thousandth of the frame is a fraction of a pixel on any frame there is; the digits past it only
  // make the CSS harder to read.
  private rounded(value: number): number {
    return Number(value.toFixed(4));
  }

  private fractionOf(hundredths: ElementControlValue | undefined): number | undefined {
    return typeof hundredths === 'number' ? Number((hundredths / 100).toFixed(6)) : undefined;
  }
}
