/**
 * How the picture passes from one shot to the next at the cut between
 * them: a flash of light, a dip to white or to black, a blur, a whip pan
 * sideways or up, a spin, a shake, a glitch, a wipe or an iris through
 * black. Each plays over the whole frame, centred on the cut, half
 * before it and half after.
 */
export type ShotTransitionKind =
  | 'flash'
  | 'fade-white'
  | 'fade-black'
  | 'blur'
  | 'whip'
  | 'whip-up'
  | 'spin'
  | 'shake'
  | 'glitch'
  | 'wipe'
  | 'iris';

/** Every kind, in the order they are offered. */
export const SHOT_TRANSITION_KINDS: readonly ShotTransitionKind[] = [
  'blur', 'whip', 'whip-up', 'spin', 'shake', 'glitch', 'flash', 'fade-white', 'fade-black', 'wipe', 'iris',
];

/**
 * How long each kind takes when it is picked, in seconds: what it was
 * designed at. A pick always starts from it, whatever the kind before
 * was set to. The hits are short, the flash a little longer for its
 * light to fall off; the dips and the iris take longer, the dip to
 * white most, its glare coming up and going down slowly.
 */
export const SHOT_TRANSITION_RECOMMENDED_DURATION_SEC: Readonly<Record<ShotTransitionKind, number>> = {
  'flash': 0.5,
  'fade-white': 0.7,
  'fade-black': 0.6,
  'blur': 0.5,
  'whip': 0.4,
  'whip-up': 0.4,
  'spin': 0.5,
  'shake': 0.4,
  'glitch': 0.4,
  'wipe': 0.5,
  'iris': 0.6,
};

/** A transition into a shot, from the one before it: what it does and how long it takes in all, in seconds. */
export interface ShotTransition {
  readonly kind: ShotTransitionKind;
  readonly durationSec: number;
}
