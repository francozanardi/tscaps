import { TimeFragment, type Document, type Segment } from '@tscaps/engine';
import type { FootageCover } from '@core/person-segmentation/domain/FootageCoverage';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { BehindActorOverride } from '@core/person-segmentation/domain/BehindActorOverride';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT } from '@core/person-segmentation/domain/BehindActorTemplateConfig';

/**
 * The single decision point for whether the text-behind-actor effect
 * is active on a segment. Combines five inputs: the user's per-segment
 * override, the section's template config (opt-in flag + tag
 * condition), the detector's valid windows, the stretches other
 * footage covers, and the segment itself.
 *
 * A segment touching covered footage is never active, not even forced
 * on: the actor it would sit behind is not on screen there. Otherwise
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
    covers: ReadonlyArray<FootageCover>,
  ): ReadonlySet<string> {
    const activeIds = new Set<string>();
    for (const section of document.sections) {
      const templateConfig = templateConfigBySectionKind.get(section.kind) ?? BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT;
      for (const segment of section.segments) {
        if (this.isEffectivelyOn(segment, overrides.get(segment.id) ?? 'auto', validWindows, templateConfig, covers)) {
          activeIds.add(segment.id);
        }
      }
    }
    return activeIds;
  }

  /** Whether `segment` is covered by other footage, which rules the effect out whatever else says. */
  isCoveredByFootage(segment: Segment, covers: ReadonlyArray<FootageCover>): boolean {
    return covers.some(({ range }) => this.overlaps(segment, range));
  }

  /**
   * The covers that rule the effect out on `segment`, each cut down to
   * the stretch of the segment it covers, earliest first; empty when
   * none does. However short that stretch, it rules out the whole
   * segment.
   */
  coversOver(segment: Segment, covers: ReadonlyArray<FootageCover>): FootageCover[] {
    return covers
      .filter(({ range }) => this.overlaps(segment, range))
      .map(({ layerId, range }) => ({
        layerId,
        range: new TimeFragment(Math.max(range.start, segment.time.start), Math.min(range.end, segment.time.end)),
      }))
      .sort((left, right) => left.range.start - right.range.start);
  }

  /**
   * Ids of the words and glyphs the effect is on while their scene's is
   * off: one the user forced on, in a scene that is not itself behind the
   * actor. Only `force-on` turns one on — no template and no detector
   * decides for a part of a scene — and one in a scene that is already
   * behind the actor has nothing left to add. Like a scene, none in a
   * scene touching covered footage is ever on.
   */
  buildActiveElementIds(
    document: Document,
    overrides: ReadonlyMap<string, BehindActorOverride>,
    activeSegmentIds: ReadonlySet<string>,
    covers: ReadonlyArray<FootageCover>,
  ): ReadonlySet<string> {
    const activeIds = new Set<string>();
    for (const segment of document.getSegments()) {
      if (activeSegmentIds.has(segment.id) || this.isCoveredByFootage(segment, covers)) continue;
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
    covers: ReadonlyArray<FootageCover>,
  ): boolean {
    if (this.isCoveredByFootage(segment, covers)) return false;
    if (override === 'force-on') return true;
    if (override === 'force-off') return false;
    return templateConfig.required
      && this.matchesTagCondition(segment, templateConfig)
      && this.isSegmentFullyContainedInAnyWindow(segment, validWindows);
  }

  private overlaps(segment: Segment, range: TimeFragment): boolean {
    return segment.time.start < range.end && range.start < segment.time.end;
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
