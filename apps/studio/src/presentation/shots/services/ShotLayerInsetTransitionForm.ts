import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import type { InsetTransitionEdge } from '@core/elements/domain/fields/InsetTransitionField';
import type { ShotLayerPlacementKind } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerInsetTransitionKind, ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';

/** A picture-in-picture transition as the panel shows it: the first layer's, and whether the others differ. */
export interface ShotLayerInsetTransitionView {
  readonly kind: ShotLayerInsetTransitionKind;
  readonly isKindMixed: boolean;
  readonly durationSec: number;
  readonly isDurationMixed: boolean;
}

/** One kind of picture-in-picture transition, as the panel offers it at an edge. */
export interface ShotLayerInsetTransitionOption {
  readonly value: ShotLayerInsetTransitionKind;
  readonly label: string;
}

/**
 * What the Motion tab says about how what floats in a picture-in-picture
 * box comes in and leaves: whether the layers edited are boxes at all,
 * the kinds to pick from, named for the edge they play at (*From full
 * screen* coming in, *To full screen* leaving), and the transition the
 * first layer has at an edge, marked mixed where the others differ.
 */
export class ShotLayerInsetTransitionForm {
  constructor(private readonly transitions: ShotLayerInsetTransitions) {}

  /** Whether every layer, laid out as `layouts` says, is a box; never for no layer. */
  isOffered(layouts: ReadonlyArray<ShotLayerPlacementKind>): boolean {
    return layouts.length > 0 && layouts.every((layout) => layout === 'inset');
  }

  // A cut moves nothing, so it reads as the motion cards' *None*.
  options(edge: InsetTransitionEdge): ReadonlyArray<ShotLayerInsetTransitionOption> {
    return [
      { value: 'cut', label: 'None' },
      { value: 'full', label: edge === 'entrance' ? 'From full screen' : 'To full screen' },
    ];
  }

  /** The transition at `edge` of the layers whose fields are `fields`, the first one's shown. Never for no layer. */
  viewOf(fields: ReadonlyArray<ElementFieldValues | undefined>, edge: InsetTransitionEdge): ShotLayerInsetTransitionView {
    const kinds = fields.map((values) => this.transitions.kindOf(values, edge));
    const durations = fields.map((values) => this.transitions.durationSecOf(values, edge));
    return {
      kind: kinds[0]!,
      isKindMixed: kinds.some((kind) => kind !== kinds[0]),
      durationSec: durations[0]!,
      isDurationMixed: durations.some((duration) => duration !== durations[0]),
    };
  }
}
