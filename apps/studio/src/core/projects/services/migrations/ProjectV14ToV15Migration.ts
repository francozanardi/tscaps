import type { HorizontalPlacementResolver } from '@tscaps/engine/advanced';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';
import type { StoredCaptionElementScanner } from '@core/projects/services/migrations/StoredCaptionElementScanner';
import { StoredSheetPlacementContext } from '@core/projects/services/migrations/StoredSheetPlacementContext';

/**
 * v14 → v15: moves where an element sits into the element's own style,
 * and leaves the segment overrides holding nothing but the
 * behind-actor answer, under a name that says so.
 *
 * Everything the editor knows about one element now lives under that
 * element's id. The two stores that remained were a placement each,
 * keyed the same way and cleared by different rules, and every reader
 * had to ask both and merge.
 *
 * Anchors are stamped on the way through. A position written before
 * the anchor was kept beside its offset carries the offset alone, and
 * a placement is now all four parts or nothing — so an offset that
 * arrived without its anchor would be dropped and the element would
 * snap back into the flow. What the sheet holds today is the anchor
 * that position was last read against, so stamping it freezes the
 * element where it already is.
 */
export class ProjectV14ToV15Migration implements ProjectMigration {
  readonly fromVersion = 14;

  constructor(
    private readonly scanner: StoredCaptionElementScanner,
    private readonly horizontalPlacementResolver: HorizontalPlacementResolver,
  ) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const { wordStyleOverrides, segmentOverrides, ...rest } = data;
    const wordPlacements = this.asRecord(wordStyleOverrides);
    const segmentPlacements = this.asRecord(this.recordAt(this.asRecord(segmentOverrides), 'style'));
    const behindActor = this.recordAt(this.asRecord(segmentOverrides), 'behindActor');

    const context = new StoredSheetPlacementContext(
      this.horizontalPlacementResolver,
      Array.isArray(data.sheets) ? data.sheets : [],
    );

    let styles = ElementStyles.fromSnapshot((data.elementStyles ?? {}) as never);
    for (const element of this.scanner.scan(data)) {
      const stored = this.recordAt(element.kind === 'segment' ? segmentPlacements : wordPlacements, element.id);
      if (!stored) continue;
      const placement = context.complete(stored, element.sheetId);
      if (placement) styles = styles.withPlacement(element.id, element.kind, placement);
    }

    return {
      ...rest,
      ...(styles.isEmpty() ? {} : { elementStyles: styles.toSnapshot() }),
      ...(behindActor && Object.keys(behindActor).length > 0 ? { behindActorOverrides: behindActor } : {}),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const held = value[key];
    if (typeof held !== 'object' || held === null || Array.isArray(held)) return null;
    return held as Record<string, unknown>;
  }
}
