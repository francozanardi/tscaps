import type { ShotLayerPlacementPatch } from '@core/shots/domain/ShotLayerPatch';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerLayoutField } from '@core/shots/services/ShotEditTelemetryReporter';

/** One layout field that took a new value. */
export interface ShotLayerLayoutChange {
  readonly field: ShotLayerLayoutField;
  readonly value: string;
}

/**
 * Reads which of a layer's layout fields that take one of a few values
 * were changed: the layout itself, how the file fills its box, what
 * fills the box around it, the side a split gives the file, and what
 * floats in a box. Fields that take any number (sizes, positions,
 * corners) are left out: they move with a slider or a drag.
 *
 * A change of layout is the only change read when the layout changed,
 * since every other field then comes from the new layout.
 */
export class ShotLayerLayoutChangeReader {
  /** What changed from `before` to `after`, in a fixed order; empty where nothing that takes a few values did. */
  between(before: ShotLayerPlacement, after: ShotLayerPlacement): ShotLayerLayoutChange[] {
    if (before.kind !== after.kind) return [{ field: 'layout', value: after.kind }];
    const changes: ShotLayerLayoutChange[] = [];
    if (before.fit !== after.fit) changes.push({ field: 'fit', value: after.fit });
    if (before.backdrop !== after.backdrop) changes.push({ field: 'backdrop', value: after.backdrop ?? 'none' });
    if (before.kind === 'split' && after.kind === 'split' && before.assetSide !== after.assetSide) {
      changes.push({ field: 'side', value: after.assetSide });
    }
    if (before.kind === 'inset' && after.kind === 'inset' && before.subject !== after.subject) {
      changes.push({ field: 'subject', value: after.subject });
    }
    return changes;
  }

  /** What `patch` sets, read off the patch itself: what several layers edited together were all given. */
  of(patch: ShotLayerPlacementPatch): ShotLayerLayoutChange[] {
    if (patch.layout !== undefined) return [{ field: 'layout', value: patch.layout }];
    const settings = patch.settings ?? {};
    const changes: ShotLayerLayoutChange[] = [];
    if (settings.fit !== undefined) changes.push({ field: 'fit', value: settings.fit });
    if ('backdrop' in settings) changes.push({ field: 'backdrop', value: settings.backdrop ?? 'none' });
    if (settings.assetSide !== undefined) changes.push({ field: 'side', value: settings.assetSide });
    if (settings.subject !== undefined) changes.push({ field: 'subject', value: settings.subject });
    return changes;
  }
}
