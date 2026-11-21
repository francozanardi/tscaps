import type { ElementStyle } from '@core/elements/domain/ElementStyles';

/** Reads the layer style a stored preset keeps, checked as the editor checks a stored style. */
export interface GraphicPresetStyleReader {
  /** `value` as a layer's style that can be trusted, or null where it is none. */
  read(value: unknown): ElementStyle | null;
}
