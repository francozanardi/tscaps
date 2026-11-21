import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/** A layer animation of the Motion tab a preset recommends, by its id, with the values it sets on its fields. */
export interface GraphicPresetAnimation {
  readonly presetId: string;
  readonly params: Readonly<Record<string, ElementControlValue>>;
}

/**
 * How a preset recommends its layer comes in and leaves; null for none. A
 * graphic's code animates what is inside its box, so most presets leave
 * the entrance to it.
 */
export interface GraphicPresetMotion {
  readonly entrance: GraphicPresetAnimation | null;
  readonly exit: GraphicPresetAnimation | null;
}
