import type { Document, Segment } from '@tscaps/engine';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { BehindActorOverride } from '@core/person-segmentation/domain/BehindActorOverride';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT } from '@core/person-segmentation/domain/BehindActorTemplateConfig';

/**
 * The single decision point for whether the text-behind-actor effect
 * is active on a segment. Combines four inputs: the user's per-segment
 * override, the section's template config (opt-in flag + tag
 * condition), the detector's valid windows, and the segment itself.
 *
 * `force-on` is always active and `force-off` never is, regardless of
 * the template. On `auto`, a segment is active only when its template
 * opts in, the segment qualifies under the template's tag condition
 * (evaluated against the union of the segment's tags; a `null`
 * condition qualifies every segment), and its entire time range fits
 * inside a single detector window — a segment straddling a window
 * boundary would flicker in and out of the effect mid-playback, so it
 * is treated as inactive. `null` windows mean the scene scan has not
 * run and qualify nothing.
 */
export class BehindActorGatingService {

  /**
   * Ids of the segments the effect is active on, across the whole
   * document. `templateConfigBySectionKind` maps each section kind to
   * its template's config; sections without an entry never activate
   * on `auto`.
   */
  buildActiveSegmentIds(
    document: Document,
    validWindows: ReadonlyArray<PersonSegmentationWindow> | null,
    overrides: ReadonlyMap<string, BehindActorOverride>,
    templateConfigBySectionKind: ReadonlyMap<string, BehindActorTemplateConfig>,
  ): ReadonlySet<string> {
    const activeIds = new Set<string>();
    for (const section of document.sections) {
      const templateConfig = templateConfigBySectionKind.get(section.kind) ?? BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT;
      for (const segment of section.segments) {
        if (this.isEffectivelyOn(segment, overrides.get(segment.id) ?? 'auto', validWindows, templateConfig)) {
          activeIds.add(segment.id);
        }
      }
    }
    return activeIds;
  }

  /**
   * Count of the segments the effect is active on inside the sections
   * routed to `sheetId`. Same rules as `buildActiveSegmentIds`, but
   * scoped to one sheet so callers can report a per-sheet outcome
   * without confusing the user with matches that belong elsewhere.
   */
  countActiveSegmentsInSheet(
    document: Document,
    sheetId: string,
    validWindows: ReadonlyArray<PersonSegmentationWindow> | null,
    overrides: ReadonlyMap<string, BehindActorOverride>,
    templateConfig: BehindActorTemplateConfig,
  ): number {
    let count = 0;
    for (const section of document.sections) {
      if (section.kind !== sheetId) continue;
      for (const segment of section.segments) {
        if (this.isEffectivelyOn(segment, overrides.get(segment.id) ?? 'auto', validWindows, templateConfig)) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Ids of the words and glyphs the effect is on while their scene's is
   * off: one the user forced on, in a scene that is not itself behind the
   * actor. Only `force-on` turns one on — no template and no detector
   * decides for a part of a scene — and one in a scene that is already
   * behind the actor has nothing left to add.
   */
  buildActiveElementIds(
    document: Document,
    overrides: ReadonlyMap<string, BehindActorOverride>,
    activeSegmentIds: ReadonlySet<string>,
  ): ReadonlySet<string> {
    const activeIds = new Set<string>();
    for (const segment of document.getSegments()) {
      if (activeSegmentIds.has(segment.id)) continue;
      for (const line of segment.lines) {
        for (const word of line.words) {
          const elementIds = word.decoration ? [word.id, word.decoration.id] : [word.id];
          for (const elementId of elementIds) {
            if (overrides.get(elementId) === 'force-on') activeIds.add(elementId);
          }
        }
      }
    }
    return activeIds;
  }

  isEffectivelyOn(
    segment: Segment,
    override: BehindActorOverride,
    validWindows: ReadonlyArray<PersonSegmentationWindow> | null,
    templateConfig: BehindActorTemplateConfig,
  ): boolean {
    if (override === 'force-on') return true;
    if (override === 'force-off') return false;
    return templateConfig.required
      && this.matchesTagCondition(segment, templateConfig)
      && this.isSegmentFullyContainedInAnyWindow(segment, validWindows);
  }

  private matchesTagCondition(segment: Segment, templateConfig: BehindActorTemplateConfig): boolean {
    if (templateConfig.tagCondition === null) return true;
    return templateConfig.tagCondition.evaluate(segment.getAllTags());
  }

  private isSegmentFullyContainedInAnyWindow(
    segment: Segment,
    windows: ReadonlyArray<PersonSegmentationWindow> | null,
  ): boolean {
    if (windows === null) return false;
    for (const window of windows) {
      if (window.start <= segment.time.start && segment.time.end <= window.end) return true;
    }
    return false;
  }
}
