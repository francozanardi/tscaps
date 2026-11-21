import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotFileLayer, ShotLayer } from '@core/shots/domain/ShotLayer';
import type {
  ShotLayerPatch,
  ShotLayerPlacementPatch,
  ShotLayerTimingPatch,
} from '@core/shots/domain/ShotLayerPatch';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';

// The shortest stretch a layer is left to play, so a start moved past
// a layer's end never leaves it with nothing.
const MIN_STRETCH_SEC = 0.1;

// What every layout holds of how its asset fills its box, beside the fit.
const PICTURE_SETTINGS: ReadonlySet<string> = new Set(['backdrop', 'position']);

type ShotLayerStretch = Pick<ShotFileLayer, 'inSec' | 'outSec' | 'loop'>;

/**
 * Writes a patch into one layer: only the fields the patch names change,
 * so a value shared by several layers can be set on all of them while
 * each keeps what it alone was given. Its stretch is the layer's own;
 * its layout is the layer's fields', which it is handed as a typed view
 * and hands back the same way, for the layout's writer to store.
 *
 * Does not clamp a layout's settings to their ranges; whoever stores
 * the layout does. A stretch it does clamp, to the layer's own file: a
 * start a file is too short for moves back to leave it the shortest
 * stretch, an end at or before the start moves past it, and an end at
 * or past the file's length plays to the file's end. The stretch only
 * reaches a layer showing a video; a picture, a GIF or a file of no
 * known type spans its shot and keeps its stretch as stored, and a
 * graphic has none.
 */
export class ShotLayerPatcher {
  constructor(private readonly placements: ShotLayerPlacementSanitizer) {}

  /** `layer` with `patch`'s timing written into it; `asset` is its file, or null where the catalog does not hold it. */
  apply(layer: ShotLayer, patch: ShotLayerPatch, asset: ShotLayerAsset | null): ShotLayer {
    if ('graphic' in layer) return layer;
    const stretch = patch.timing && asset?.kind === 'video'
      ? this.patchedStretch(layer, patch.timing, asset.durationSec)
      : layer;
    return { ...layer, inSec: stretch.inSec, outSec: stretch.outSec, loop: stretch.loop };
  }

  /** The layout `current` becomes with `patch` written into it. */
  patchedPlacement(current: ShotLayerPlacement, patch: ShotLayerPlacementPatch): ShotLayerPlacement {

    const laidOut = patch.layout === undefined || patch.layout === current.kind
      ? current
      : { ...this.placements.fresh(patch.layout), ...this.picture(current) };
    const patched: Record<string, unknown> = { ...laidOut };
    for (const [setting, value] of Object.entries(patch.settings ?? {})) {
      if (value !== undefined && (setting in laidOut || PICTURE_SETTINGS.has(setting))) patched[setting] = value;
    }
    return patched as unknown as ShotLayerPlacement;
  }

  /** How `placement`'s asset fills its box, which a switch of layout keeps. */
  private picture(placement: ShotLayerPlacement): Pick<ShotLayerPlacement, 'fit' | 'backdrop' | 'position'> {
    return {
      fit: placement.fit,
      ...(placement.backdrop === undefined ? {} : { backdrop: placement.backdrop }),
      ...(placement.position === undefined ? {} : { position: placement.position }),
    };
  }

  private patchedStretch(layer: ShotFileLayer, patch: ShotLayerTimingPatch, durationSec: number | null): ShotLayerStretch {
    const requestedInSec = patch.inSec ?? layer.inSec;
    const inSec = durationSec === null
      ? requestedInSec
      : Math.max(0, Math.min(requestedInSec, durationSec - MIN_STRETCH_SEC));
    const requestedOutSec = patch.outSec === undefined ? layer.outSec : patch.outSec;
    return { inSec, outSec: this.endAfter(inSec, requestedOutSec, durationSec), loop: patch.loop ?? layer.loop };
  }

  private endAfter(inSec: number, outSec: number | null, durationSec: number | null): number | null {
    if (outSec === null) return null;
    const end = Math.max(outSec, inSec + MIN_STRETCH_SEC);
    return durationSec !== null && end >= durationSec ? null : end;
  }
}
