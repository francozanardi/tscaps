/**
 * A colour grade over the whole composed picture, beneath captions.
 * Every value is 0 when it changes nothing.
 *
 * - `exposure`, -1 to 1: a stop darker to a stop brighter.
 * - `contrast`, -1 to 1: flat to doubled, about mid grey.
 * - `saturation`, -1 to 1: grey to doubled colour.
 * - `temperature`, -1 to 1: cooler (bluer) to warmer (redder).
 * - `tint`, -1 to 1: greener to more magenta.
 * - `vignette`, 0 to 1: how far the corners darken.
 *
 * Values past their range are taken at its nearest end.
 */
export interface FootageGrade {
  readonly exposure: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly temperature: number;
  readonly tint: number;
  readonly vignette: number;
}
