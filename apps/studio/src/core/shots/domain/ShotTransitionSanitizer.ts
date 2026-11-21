import {
  SHOT_TRANSITION_KINDS,
  SHOT_TRANSITION_RECOMMENDED_DURATION_SEC,
  type ShotTransition,
  type ShotTransitionKind,
} from '@core/shots/domain/ShotTransition';

/**
 * The one place a shot transition is checked, for what is read back
 * from storage and for what an edit writes alike.
 */
export class ShotTransitionSanitizer {
  static readonly MIN_DURATION_SEC = 0.2;
  static readonly MAX_DURATION_SEC = 1.5;

  /**
   * `value` as a transition that can be trusted, or null when it names
   * no kind there is. A duration that cannot be read takes the one its
   * kind recommends; one out of range is clamped into it.
   */
  sanitize(value: unknown): ShotTransition | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    const kind = raw['kind'];
    if (typeof kind !== 'string' || !SHOT_TRANSITION_KINDS.includes(kind as ShotTransitionKind)) return null;
    const durationSec = raw['durationSec'];
    return {
      kind: kind as ShotTransitionKind,
      durationSec: typeof durationSec === 'number' && Number.isFinite(durationSec)
        ? Math.min(ShotTransitionSanitizer.MAX_DURATION_SEC, Math.max(ShotTransitionSanitizer.MIN_DURATION_SEC, durationSec))
        : SHOT_TRANSITION_RECOMMENDED_DURATION_SEC[kind as ShotTransitionKind],
    };
  }
}
