import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { SplitTransitionEdge } from '@core/elements/domain/fields/SplitTransitionField';

/**
 * How a split frame divides as a layer comes in, or joins back as it
 * leaves: at once, the layer's part sliding in with the dividing line,
 * or the line uncovering the part where it rests.
 */
export type ShotLayerSplitTransitionKind = 'cut' | 'slide' | 'reveal';

const VALUE_BY_KIND: Readonly<Record<ShotLayerSplitTransitionKind, string>> = { cut: '0', slide: '1', reveal: '2' };
const KIND_BY_VALUE: ReadonlyMap<string, ShotLayerSplitTransitionKind> = new Map([
  ['0', 'cut'],
  ['1', 'slide'],
  ['2', 'reveal'],
]);
// What a layer whose fields hold nothing does, which is what the stage's framework draws then.
const FRESH_KIND: ShotLayerSplitTransitionKind = 'slide';
const FRESH_DURATION_SEC = 0.5;

/**
 * Reads a layer's split transitions off the fields they are recorded
 * in, and names the fields and values that record them. A layer whose
 * fields say nothing slides in and out over half a second, as the
 * stage draws it.
 */
export class ShotLayerSplitTransitions {
  /** The transition `values` record at `edge`. */
  kindOf(values: ElementFieldValues | undefined, edge: SplitTransitionEdge): ShotLayerSplitTransitionKind {
    const held = values?.[this.kindFieldOf(edge)];
    return (typeof held === 'string' ? KIND_BY_VALUE.get(held) : undefined) ?? FRESH_KIND;
  }

  /** How long, in seconds, the transition `values` record at `edge` takes. */
  durationSecOf(values: ElementFieldValues | undefined, edge: SplitTransitionEdge): number {
    const held = values?.[this.durationFieldOf(edge)];
    return typeof held === 'number' && Number.isFinite(held) ? held : FRESH_DURATION_SEC;
  }

  kindFieldOf(edge: SplitTransitionEdge): ElementFieldId {
    return edge === 'entrance' ? ElementFieldId.SPLIT_ENTRANCE : ElementFieldId.SPLIT_EXIT;
  }

  durationFieldOf(edge: SplitTransitionEdge): ElementFieldId {
    return edge === 'entrance' ? ElementFieldId.SPLIT_ENTRANCE_DURATION : ElementFieldId.SPLIT_EXIT_DURATION;
  }

  /** The value `kind` is recorded as. */
  valueOf(kind: ShotLayerSplitTransitionKind): string {
    return VALUE_BY_KIND[kind];
  }
}
