/**
 * Where a preset's sound plays on its layer: on one of the moments its
 * code declares, on the layer's entry or exit, on the transition its
 * layout plays at its entrance or exit, or on its camera move.
 */
export type GraphicPresetSoundSpot =
  | { readonly kind: 'moment'; readonly momentId: string }
  | { readonly kind: 'edge'; readonly edge: 'entry' | 'exit' }
  | { readonly kind: 'transition'; readonly edge: 'entrance' | 'exit' }
  | { readonly kind: 'camera' };

/**
 * A sound a preset brings with it: where it plays, which bundled sound,
 * how loud (0 to 1), and how far from that spot it starts, in seconds
 * (negative is before it).
 */
export interface GraphicPresetSound {
  readonly spot: GraphicPresetSoundSpot;
  readonly soundId: string;
  readonly volume: number;
  readonly offsetSec: number;
}
