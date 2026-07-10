import type { Document, Segment, InlineStyleMap } from '@tscaps/engine';
import { CssVariable } from '@tscaps/engine';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';

interface BehindActorSegmentDecision {
  readonly sceneValid: boolean;
  readonly forced: boolean;
}

/**
 * Derives the per-segment inline CSS variables the engine consumes to
 * publish text-behind-actor state on the segment wrapper. Combines
 * three inputs: the detector's valid windows, the user's per-segment
 * overrides, and the document's segments.
 *
 * A segment is marked `scene-valid` only when its entire time range
 * fits inside a single detector window; a segment straddling a window
 * boundary would flicker in and out of the effect mid-playback, so it
 * is treated as invalid. The user's override can force either input
 * on or off regardless of the detector's verdict.
 *
 * The returned map omits any segment whose inputs are all false, so
 * callers only pay for segments that actually publish state.
 */
export class BehindActorGatingService {

  buildSegmentInlineVars(
    document: Document,
    validWindows: ReadonlyArray<PersonSegmentationWindow>,
    overrides: ReadonlyMap<string, BehindActorSegmentOverride>,
  ): ReadonlyMap<string, InlineStyleMap> {
    const result = new Map<string, InlineStyleMap>();
    for (const section of document.sections) {
      for (const segment of section.segments) {
        const decision = this.decide(segment, overrides.get(segment.id) ?? 'auto', validWindows);
        const vars = this.serializeVars(decision);
        if (Object.keys(vars).length > 0) result.set(segment.id, vars);
      }
    }
    return result;
  }

  /**
   * Whether the effect applies to `segment` once the user's override
   * is combined with the detector's verdict: `force-on` is always on,
   * `force-off` is always off, `auto` follows the windows.
   */
  isEffectivelyOn(
    segment: Segment,
    override: BehindActorSegmentOverride,
    validWindows: ReadonlyArray<PersonSegmentationWindow>,
  ): boolean {
    return this.decide(segment, override, validWindows).sceneValid;
  }

  private decide(
    segment: Segment,
    override: BehindActorSegmentOverride,
    validWindows: ReadonlyArray<PersonSegmentationWindow>,
  ): BehindActorSegmentDecision {
    if (override === 'force-on') return { sceneValid: true, forced: true };
    if (override === 'force-off') return { sceneValid: false, forced: false };
    return { sceneValid: this.isSegmentFullyContainedInAnyWindow(segment, validWindows), forced: false };
  }

  private isSegmentFullyContainedInAnyWindow(
    segment: Segment,
    windows: ReadonlyArray<PersonSegmentationWindow>,
  ): boolean {
    for (const window of windows) {
      if (window.start <= segment.time.start && segment.time.end <= window.end) return true;
    }
    return false;
  }

  private serializeVars(decision: BehindActorSegmentDecision): InlineStyleMap {
    const vars: Record<string, string> = {};
    if (decision.sceneValid) vars[CssVariable.BEHIND_ACTOR_SCENE_VALID] = '1';
    if (decision.forced) vars[CssVariable.BEHIND_ACTOR_FORCED] = '1';
    return vars;
  }
}
