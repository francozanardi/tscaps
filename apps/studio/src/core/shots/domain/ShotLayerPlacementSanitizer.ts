import type { FootageFit } from '@tscaps/engine/advanced';
import type {
  FullShotLayerPlacement,
  InsetShotLayerPlacement,
  ShotLayerPlacement,
  ShotLayerPlacementKind,
  SplitShotLayerPlacement,
} from '@core/shots/domain/ShotLayerPlacement';
import {
  SHOT_LAYER_PLACEMENT_RANGES,
  type ShotLayerPlacementRange as Range,
} from '@core/shots/domain/ShotLayerPlacementRanges';

const {
  splitAssetRatio: SPLIT_ASSET_RATIO,
  splitPadding: SPLIT_PADDING,
  insetWidth: INSET_WIDTH,
  insetPadding: INSET_PADDING,
  center: CENTER,
  cornerRadius: CORNER_RADIUS,
  aspectRatio: ASPECT_RATIO,
} = SHOT_LAYER_PLACEMENT_RANGES;

const SHARE: Range = { min: 0, max: 1 };
const CENTRED = 0.5;

const FRESH_FULL: FullShotLayerPlacement = { kind: 'full', fit: 'cover' };
const FRESH_SPLIT: SplitShotLayerPlacement = {
  kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover',
};
const FRESH_INSET: InsetShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: null, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};

/**
 * The one place a placement's settings are checked and clamped, for
 * what is read back from storage and for what an edit writes alike.
 */
export class ShotLayerPlacementSanitizer {

  /**
   * `value` as a placement that can be trusted: null when it names no
   * known layout, and otherwise every setting clamped to its range, a
   * setting that cannot be read taking the layout's fresh value.
   */
  sanitize(value: unknown): ShotLayerPlacement | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    switch (raw['kind']) {
      case 'full': return this.full(raw);
      case 'split': return this.split(raw);
      case 'inset': return this.inset(raw);
      default: return null;
    }
  }

  /** A layout's settings before anyone has changed them. */
  fresh(kind: ShotLayerPlacementKind): ShotLayerPlacement {
    switch (kind) {
      case 'full': return FRESH_FULL;
      case 'split': return FRESH_SPLIT;
      case 'inset': return FRESH_INSET;
    }
  }

  /** Whether two sanitized placements say the same thing. */
  isSame(first: ShotLayerPlacement, second: ShotLayerPlacement): boolean {
    // Sanitized placements are built with their keys in one order, so
    // their serializations are equal exactly when every setting is.
    return JSON.stringify(first) === JSON.stringify(second);
  }

  private full(raw: Record<string, unknown>): FullShotLayerPlacement {
    const fit = this.fit(raw['fit'], FRESH_FULL.fit);
    return { kind: 'full', fit, ...this.picture(raw, fit) };
  }

  private split(raw: Record<string, unknown>): SplitShotLayerPlacement {
    return {
      kind: 'split',
      assetSide: raw['assetSide'] === 'end' ? 'end' : 'start',
      assetRatio: this.clamped(raw['assetRatio'], SPLIT_ASSET_RATIO, FRESH_SPLIT.assetRatio),
      padding: this.clamped(raw['padding'], SPLIT_PADDING, FRESH_SPLIT.padding),
      cornerRadius: this.clamped(raw['cornerRadius'], CORNER_RADIUS, FRESH_SPLIT.cornerRadius),
      ...this.fitted(raw, FRESH_SPLIT.fit),
    };
  }

  private inset(raw: Record<string, unknown>): InsetShotLayerPlacement {
    return {
      kind: 'inset',
      subject: raw['subject'] === 'video' ? 'video' : 'asset',
      centerX: this.clamped(raw['centerX'], CENTER, FRESH_INSET.centerX),
      centerY: this.clamped(raw['centerY'], CENTER, FRESH_INSET.centerY),
      width: this.clamped(raw['width'], INSET_WIDTH, FRESH_INSET.width),
      aspectRatio: this.clamped(raw['aspectRatio'], ASPECT_RATIO, null),
      padding: this.clamped(raw['padding'], INSET_PADDING, FRESH_INSET.padding),
      cornerRadius: this.clamped(raw['cornerRadius'], CORNER_RADIUS, FRESH_INSET.cornerRadius),
      ...this.fitted(raw, FRESH_INSET.fit),
    };
  }

  /** How the asset fills its box, then what it reads of the fill and the crop. */
  private fitted(raw: Record<string, unknown>, fallback: FootageFit): Pick<FullShotLayerPlacement, 'fit' | 'backdrop' | 'position'> {
    const fit = this.fit(raw['fit'], fallback);
    return { fit, ...this.picture(raw, fit) };
  }

  /**
   * The fill and the crop `fit` reads, and nothing else: a backdrop only
   * around an asset fitted inside its box, a position only for one
   * filling it, and only off the centre, which is where it sits unset.
   */
  private picture(raw: Record<string, unknown>, fit: FootageFit): Pick<FullShotLayerPlacement, 'backdrop' | 'position'> {
    const backdrop = raw['backdrop'];
    if (fit === 'contain') return backdrop === 'black' || backdrop === 'blur' ? { backdrop } : {};
    const held = typeof raw['position'] === 'object' && raw['position'] !== null ? raw['position'] as Record<string, unknown> : {};
    const x = this.clamped(held['x'], SHARE, CENTRED);
    const y = this.clamped(held['y'], SHARE, CENTRED);
    return x === CENTRED && y === CENTRED ? {} : { position: { x, y } };
  }

  private fit(value: unknown, fallback: FootageFit): FootageFit {
    return value === 'cover' || value === 'contain' ? value : fallback;
  }

  private clamped<Fallback extends number | null>(value: unknown, range: Range, fallback: Fallback): number | Fallback {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(range.max, Math.max(range.min, value));
  }
}
