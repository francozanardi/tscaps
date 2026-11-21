import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { InsetTransitionEdge } from '@core/elements/domain/fields/InsetTransitionField';

/**
 * How what floats in a picture-in-picture box comes in, or leaves: in
 * its box at once, or from the whole frame, shrinking into the box (and
 * growing back to the whole frame as it leaves).
 */
export type ShotLayerInsetTransitionKind = 'cut' | 'full';

const VALUE_BY_KIND: Readonly<Record<ShotLayerInsetTransitionKind, string>> = { cut: '0', full: '1' };
const KIND_BY_VALUE: ReadonlyMap<string, ShotLayerInsetTransitionKind> = new Map([
  ['0', 'cut'],
  ['1', 'full'],
]);
// What a layer whose fields hold nothing does, which is what the stage's framework draws then.
const FRESH_KIND: ShotLayerInsetTransitionKind = 'cut';
const FRESH_DURATION_SEC = 0.5;

/**
 * Reads a layer's picture-in-picture transitions off the fields they are
 * recorded in, and names the fields and values that record them. A
 * layer whose fields say nothing is in its box from its first frame to
 * its last, as the stage draws it.
 */
export class ShotLayerInsetTransitions {
  /** The transition `values` record at `edge`. */
  kindOf(values: ElementFieldValues | undefined, edge: InsetTransitionEdge): ShotLayerInsetTransitionKind {
    const held = values?.[this.kindFieldOf(edge)];
    return (typeof held === 'string' ? KIND_BY_VALUE.get(held) : undefined) ?? FRESH_KIND;
  }

  /** How long, in seconds, the transition `values` record at `edge` takes. */
  durationSecOf(values: ElementFieldValues | undefined, edge: InsetTransitionEdge): number {
    const held = values?.[this.durationFieldOf(edge)];
    return typeof held === 'number' && Number.isFinite(held) ? held : FRESH_DURATION_SEC;
  }

  kindFieldOf(edge: InsetTransitionEdge): ElementFieldId {
    return edge === 'entrance' ? ElementFieldId.INSET_ENTRANCE : ElementFieldId.INSET_EXIT;
  }

  durationFieldOf(edge: InsetTransitionEdge): ElementFieldId {
    return edge === 'entrance' ? ElementFieldId.INSET_ENTRANCE_DURATION : ElementFieldId.INSET_EXIT_DURATION;
  }

  /** The value `kind` is recorded as. */
  valueOf(kind: ShotLayerInsetTransitionKind): string {
    return VALUE_BY_KIND[kind];
  }
}
