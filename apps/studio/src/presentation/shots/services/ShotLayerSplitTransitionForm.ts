import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import type { SplitTransitionEdge } from '@core/elements/domain/fields/SplitTransitionField';
import type { ShotLayerPlacementKind } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerSplitTransitionKind, ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';

/** A split transition as the panel shows it: the first layer's, and whether the others differ. */
export interface ShotLayerSplitTransitionView {
  readonly kind: ShotLayerSplitTransitionKind;
  readonly isKindMixed: boolean;
  readonly durationSec: number;
  readonly isDurationMixed: boolean;
}

/** One kind of split transition, as the panel offers it. */
export interface ShotLayerSplitTransitionOption {
  readonly value: ShotLayerSplitTransitionKind;
  readonly label: string;
}

// A cut moves nothing, so it reads as the motion cards' *None*.
const OPTIONS: ReadonlyArray<ShotLayerSplitTransitionOption> = [
  { value: 'cut', label: 'None' },
  { value: 'slide', label: 'Slide' },
  { value: 'reveal', label: 'Reveal' },
];

/**
 * What the Motion tab says about how a split frame divides as layers
 * come in and joins back as they leave: whether the layers edited are
 * split at all, the kinds to pick from, and the transition the first
 * layer has at an edge, marked mixed where the others differ.
 */
export class ShotLayerSplitTransitionForm {
  constructor(private readonly transitions: ShotLayerSplitTransitions) {}

  /** Whether every layer, laid out as `layouts` says, splits the frame; never for no layer. */
  isOffered(layouts: ReadonlyArray<ShotLayerPlacementKind>): boolean {
    return layouts.length > 0 && layouts.every((layout) => layout === 'split');
  }

  options(): ReadonlyArray<ShotLayerSplitTransitionOption> {
    return OPTIONS;
  }


  /** The transition at `edge` of the layers whose fields are `fields`, the first one's shown. Never for no layer. */
  viewOf(fields: ReadonlyArray<ElementFieldValues | undefined>, edge: SplitTransitionEdge): ShotLayerSplitTransitionView {
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
