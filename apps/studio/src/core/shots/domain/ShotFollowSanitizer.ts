import type { TrackedHead } from '@core/subject-tracking/domain/TrackedHead';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { FollowPickFrame, ShotFollow } from '@core/shots/domain/ShotFollow';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SeenPerson } from '@core/subject-tracking/domain/SeenPerson';

/**
 * The one place a shot's follow is checked, for what is read back from
 * storage and for what an edit writes alike.
 */
export class ShotFollowSanitizer {
  /**
   * `value` as a follow that can be trusted: the heads that can be read,
   * in time order, one per moment, each share inside the picture, the
   * frame it was picked on where all of it can be read, and where the
   * camera looks until the person is found where it can be read. Null
   * where the picture's shape cannot be read or no head is left.
   */
  sanitize(value: unknown): ShotFollow | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    const pictureAspectRatio = raw['pictureAspectRatio'];
    if (typeof pictureAspectRatio !== 'number' || !Number.isFinite(pictureAspectRatio) || pictureAspectRatio <= 0) return null;
    const heads = this.headsOf(raw['heads']);
    if (heads.length === 0) return null;
    const picked = this.pickedOf(raw['picked']);
    const untilFound = this.positionOf(raw['untilFound']);
    return {
      pictureAspectRatio,
      heads,
      ...(picked === null ? {} : { picked }),
      ...(untilFound === null ? {} : { untilFound }),
    };
  }

  private positionOf(value: unknown): PicturePosition | null {
    if (typeof value !== 'object' || value === null) return null;
    const { x, y } = value as Record<string, unknown>;
    return this.isShare(x) && this.isShare(y) ? { x, y } : null;
  }

  /** The frame the follow was picked on, or null where any of it cannot be read or what is followed is not among it. */
  private pickedOf(value: unknown): FollowPickFrame | null {
    if (typeof value !== 'object' || value === null) return null;
    const { sourceSec, people, chosen } = value as Record<string, unknown>;
    if (typeof sourceSec !== 'number' || !Number.isFinite(sourceSec) || sourceSec < 0 || !Array.isArray(people)) return null;
    const seen = people.map((person) => this.seenPersonOf(person));
    if (seen.length === 0 || seen.some((person) => person === null)) return null;
    if (typeof chosen !== 'number' || !Number.isInteger(chosen) || chosen < 0 || chosen >= seen.length) return null;
    return { sourceSec, people: seen as SeenPerson[], chosen };
  }

  private seenPersonOf(value: unknown): SeenPerson | null {
    if (typeof value !== 'object' || value === null) return null;
    const { box, head } = value as Record<string, unknown>;
    const readBox = this.boxOf(box);
    if (readBox === null || typeof head !== 'object' || head === null) return null;
    const { x, y } = head as Record<string, unknown>;
    return this.isShare(x) && this.isShare(y) ? { box: readBox, head: { x, y } } : null;
  }

  private boxOf(value: unknown): NormalizedBbox | null {
    if (typeof value !== 'object' || value === null) return null;
    const { minX, minY, maxX, maxY } = value as Record<string, unknown>;
    if (!this.isShare(minX) || !this.isShare(minY) || !this.isShare(maxX) || !this.isShare(maxY)) return null;
    return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null;
  }

  private headsOf(value: unknown): TrackedHead[] {
    if (!Array.isArray(value)) return [];
    const bySecond = new Map<number, TrackedHead>();
    for (const entry of value) {
      const head = this.headOf(entry);
      if (head !== null) bySecond.set(head.sourceSec, head);
    }
    return [...bySecond.values()].sort((first, second) => first.sourceSec - second.sourceSec);
  }

  private headOf(value: unknown): TrackedHead | null {
    if (typeof value !== 'object' || value === null) return null;
    const { sourceSec, x, y } = value as Record<string, unknown>;
    if (typeof sourceSec !== 'number' || !Number.isFinite(sourceSec) || sourceSec < 0) return null;
    if (!this.isShare(x) || !this.isShare(y)) return null;
    return { sourceSec, x, y };
  }

  private isShare(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  }
}
