import type { CssFragmentParser } from '@tscaps/engine/advanced';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ShotLayerAnimationScope } from '@core/shots/actions/SetShotLayerAnimationAction';
import type { ShotLayerGroupField } from '@presentation/shots/services/ShotLayerGroupForm';

/** What a layer's own CSS has taken over from its panels. */
export interface ShotLayerTakeover {
  /** The layout editor's fields whose declaration the CSS now decides. */
  readonly layoutFields: ReadonlySet<ShotLayerGroupField>;
  /** The parts of the layer's motion the CSS now decides: its ends, and its camera's move. */
  readonly motion: ReadonlySet<ShotLayerAnimationScope>;
  /** Whether the CSS now decides where the camera looks, past its position fields. */
  readonly cameraPosition: boolean;
}

const FIELD_BY_ID: ReadonlyMap<string, ShotLayerGroupField> = new Map<string, ShotLayerGroupField>([
  [ElementFieldId.LAYOUT, 'layout'],
  [ElementFieldId.FIT, 'fit'],
  [ElementFieldId.CORNER_RADIUS, 'cornerRadius'],
  [ElementFieldId.PADDING, 'padding'],
  [ElementFieldId.SPLIT_SIDE, 'assetSide'],
  [ElementFieldId.SPLIT_RATIO, 'assetRatio'],
  [ElementFieldId.CENTER_X, 'centerX'],
  [ElementFieldId.CENTER_Y, 'centerY'],
  [ElementFieldId.WIDTH, 'width'],
  [ElementFieldId.ASPECT_RATIO, 'aspectRatio'],
  [ElementFieldId.INSET_SUBJECT, 'subject'],
]);

// A box placed or sized by hand: no field writes these, so a declaration
// of one is the layer's own, and it wins over what the layout fields build.
const FIELDS_BY_HAND_PROPERTY: ReadonlyMap<string, ReadonlyArray<ShotLayerGroupField>> = new Map<string, ReadonlyArray<ShotLayerGroupField>>([
  ['left', ['centerX', 'assetSide']],
  ['right', ['centerX', 'assetSide']],
  ['margin-left', ['centerX', 'assetSide']],
  ['--layer-box-left', ['centerX', 'assetSide']],
  ['top', ['centerY', 'assetSide']],
  ['bottom', ['centerY', 'assetSide']],
  ['margin-top', ['centerY', 'assetSide']],
  ['--layer-box-top', ['centerY', 'assetSide']],
  ['inset', ['centerX', 'centerY', 'assetSide']],
  ['width', ['width', 'aspectRatio', 'assetRatio']],
  ['--layer-box-width', ['width', 'aspectRatio', 'assetRatio']],
  ['height', ['width', 'aspectRatio', 'assetRatio']],
  ['--layer-box-height', ['width', 'aspectRatio', 'assetRatio']],
  ['--video-left', ['assetSide', 'assetRatio']],
  ['--video-top', ['assetSide', 'assetRatio']],
  ['--video-width', ['assetSide', 'assetRatio']],
  ['--video-height', ['assetSide', 'assetRatio']],
]);

// An `animation` of the layer's own replaces the list the framework plays both ends and the camera from.
const HAND_ANIMATION_PROPERTIES: ReadonlySet<string> = new Set(['animation', 'animation-name']);
const SCOPES: ReadonlyArray<ShotLayerAnimationScope> = [
  ElementAnimationScope.ENTRANCE,
  ElementAnimationScope.EXIT,
  ElementAnimationScope.CAMERA,
];
// Where the camera looks, at the start and at the end of its move: the property each field writes.
const CAMERA_POSITION_FIELD_BY_PROPERTY: ReadonlyMap<string, ElementFieldId> = new Map([
  ['--layer-picture-x', ElementFieldId.PICTURE_X],
  ['--layer-picture-y', ElementFieldId.PICTURE_Y],
  ['--layer-picture-end-x', ElementFieldId.PICTURE_END_X],
  ['--layer-picture-end-y', ElementFieldId.PICTURE_END_Y],
]);

/**
 * Says which of a shot layer's panel fields its own CSS has taken over,
 * so a field that has stopped deciding anything says so instead of
 * quietly doing nothing.
 *
 * Two ways a field is taken: its own declaration was written over, which
 * is asked the way any element field asks it (would writing the value
 * again change the text?), or a declaration no field writes now decides
 * what it would: `left` or `--layer-box-*` place the box past the
 * position and size, `--video-*` moves the video past a split's side and
 * size. A motion, the camera's move included, is taken when its block
 * was written over, or when an `animation` of the layer's own replaces
 * the list they are all played from. The camera's position is taken when
 * a position field's declaration was written over, or one is declared
 * that no field wrote. Only the top level counts: a keyframe moving the
 * box comes back to rest.
 */
export class ShotLayerTakeoverReader {
  constructor(
    private readonly fields: CssControlledFieldFinder,
    private readonly controls: ReadonlyArray<AuthoredElementControl>,
    private readonly animations: ElementAnimationCssWriter,
    private readonly parser: CssFragmentParser,
  ) {}

  /** What `style`'s CSS has taken over; nothing for a layer never styled. */
  read(style: ElementStyle | null): ShotLayerTakeover {
    const declared = this.declaredProperties(style?.css ?? '');
    return {
      layoutFields: this.layoutFieldsTaken(style, declared),
      motion: this.motionTaken(style, declared),
      cameraPosition: this.cameraPositionTaken(style, declared),
    };
  }

  private cameraPositionTaken(style: ElementStyle | null, declared: ReadonlySet<string>): boolean {
    const positionFieldIds = new Set<string>(CAMERA_POSITION_FIELD_BY_PROPERTY.values());
    if ([...this.fields.find(style, this.controls)].some((id) => positionFieldIds.has(id))) return true;
    return [...CAMERA_POSITION_FIELD_BY_PROPERTY].some(([property, fieldId]) => declared.has(property) && style?.fields?.[fieldId] === undefined);
  }

  private layoutFieldsTaken(style: ElementStyle | null, declared: ReadonlySet<string>): ReadonlySet<ShotLayerGroupField> {
    const taken = new Set<ShotLayerGroupField>();
    for (const id of this.fields.find(style, this.controls)) {
      const field = FIELD_BY_ID.get(id);
      if (field !== undefined) taken.add(field);
    }
    for (const property of declared) {
      for (const field of FIELDS_BY_HAND_PROPERTY.get(property) ?? []) taken.add(field);
    }
    return taken;
  }

  private motionTaken(style: ElementStyle | null, declared: ReadonlySet<string>): ReadonlySet<ShotLayerAnimationScope> {
    if ([...declared].some((property) => HAND_ANIMATION_PROPERTIES.has(property))) return new Set(SCOPES);
    return new Set(SCOPES.filter((scope) => {
      const animation = style?.animations?.[scope];
      return animation !== undefined && this.animations.isTakenOver(style?.css ?? '', 'layer', scope, animation);
    }));
  }

  private declaredProperties(css: string): ReadonlySet<string> {
    const declared = new Set<string>();
    for (const part of this.parser.parse(css)) {
      if (part.kind === 'declaration') declared.add(part.property.toLowerCase());
    }
    return declared;
  }
}
