import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementControlCssWriter, ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

type Layout = 'full' | 'split' | 'inset';
type LayoutValues = Partial<Record<ElementFieldId, ElementControlValue>>;

interface Range {
  readonly min: number;
  readonly max: number;
}

// What v23 clamped a placement's settings to, and what it read a setting it could not read as.
const RANGES: Readonly<Record<string, Range>> = {
  splitAssetRatio: { min: 0.3, max: 0.7 },
  splitPadding: { min: 0, max: 0.1 },
  insetWidth: { min: 0.1, max: 1 },
  insetPadding: { min: 0, max: 0.2 },
  center: { min: 0, max: 1 },
  cornerRadius: { min: 0, max: 0.5 },
  aspectRatio: { min: 0.2, max: 5 },
};
const FRESH_SPLIT = { assetRatio: 0.5, padding: 0, cornerRadius: 0 };
const FRESH_INSET = { centerX: 0.5, centerY: 0.5, width: 0.4, padding: 0.04, cornerRadius: 0.04 };
const LAYOUT_VALUE: Readonly<Record<Layout, string>> = { full: '0', split: '1', inset: '2' };
const ROLES = ['video', 'picture'] as const;

/**
 * v23 → v24: a shot layer's placement becomes fields of the layer's
 * style, and the CSS they write.
 *
 * In v23 each layer held `placement`, a layout (`kind`: `full`, `split`
 * or `inset`) and its settings, which the editor turned into rects. Each
 * becomes the layout fields of the layer's style under
 * `shots.layerStyles[layerId]` (kind `layer`), with the declarations
 * they write appended to whatever CSS the style already held — its
 * motion: `layout` (`0` full, `1` split, `2` inset) and `fit` always;
 * for a split its `split-side` (`0` start, `1` end), `split-ratio`,
 * `padding` and `corner-radius`; for an inset its `center-x`,
 * `center-y`, `width`, `padding`, `corner-radius` and, where the
 * placement set one, `aspect-ratio`. Padding and corners go from a
 * fraction of the frame's shorter side to hundredths of it, the unit
 * their declarations are written in; every other setting carries over
 * as it was. A setting v23 could not read, or held out of its range,
 * is written as v23 drew it: its layout's fresh value, or clamped.
 * A placement naming no layout writes nothing, which is the full frame
 * v23 drew it on.
 *
 * `shots.lastEditedPlacements` becomes `shots.lastEditedLayouts`, each
 * role's placement as the same field values, with no CSS.
 *
 * The writer and the catalog are borrowed from production, as
 * `ProjectV13ToV14Migration` borrows them: spelled out by hand, the
 * declarations would be text the editor does not recognise as written
 * by its fields.
 */
export class ProjectV23ToV24Migration implements ProjectMigration {
  readonly fromVersion = 23;

  constructor(
    private readonly catalog: StyledElementCatalog,
    private readonly controls: ElementControlCssWriter,
  ) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(data.shots)) return { ...data };
    const styles: Record<string, unknown> = this.isRecord(data.shots.layerStyles) ? { ...data.shots.layerStyles } : {};
    const shots = Array.isArray(data.shots.shots)
      ? data.shots.shots.map((shot) => this.migratedShot(shot, styles))
      : data.shots.shots;
    const { layerStyles: _replaced, lastEditedPlacements, ...rest } = data.shots;
    const lastEditedLayouts = this.lastEditedLayoutsOf(lastEditedPlacements);
    return {
      ...data,
      shots: {
        ...rest,
        shots,
        ...(lastEditedLayouts === null ? {} : { lastEditedLayouts }),
        ...(Object.keys(styles).length > 0 ? { layerStyles: styles } : {}),
      },
    };
  }

  private migratedShot(shot: unknown, styles: Record<string, unknown>): unknown {
    if (!this.isRecord(shot) || !Array.isArray(shot.layers)) return shot;
    return { ...shot, layers: shot.layers.map((layer) => this.migratedLayer(layer, styles)) };
  }

  /** The layer without its placement, which lands in its style. */
  private migratedLayer(layer: unknown, styles: Record<string, unknown>): unknown {
    if (!this.isRecord(layer)) return layer;
    const { placement, ...kept } = layer;
    const values = this.valuesOf(placement);
    if (typeof layer.id !== 'string' || layer.id === '' || values === null) return kept;
    styles[layer.id] = this.styleWith(styles[layer.id], values);
    return kept;
  }

  /** `held`, a stored layer style or nothing, holding `values` as fields and the declarations they write after its CSS. */
  private styleWith(held: unknown, values: LayoutValues): Record<string, unknown> {
    const style = this.isRecord(held) ? held : {};
    const fields = this.isRecord(style.fields) ? { ...style.fields } : {};
    let css = typeof style.css === 'string' ? style.css : '';
    for (const [fieldId, value] of Object.entries(values) as Array<[ElementFieldId, ElementControlValue]>) {
      css = this.controls.write(css, this.catalog.requireControl('layer', fieldId), value);
      fields[fieldId] = value;
    }
    return { ...style, kind: 'layer', fields, css };
  }

  private lastEditedLayoutsOf(value: unknown): Record<string, LayoutValues> | null {
    if (!this.isRecord(value)) return null;
    const layouts: Record<string, LayoutValues> = {};
    for (const role of ROLES) {
      const values = this.valuesOf(value[role]);
      if (values !== null) layouts[role] = values;
    }
    return Object.keys(layouts).length > 0 ? layouts : null;
  }

  /** A v23 placement as the field values it becomes; null where it names no layout. */
  private valuesOf(placement: unknown): LayoutValues | null {
    if (!this.isRecord(placement)) return null;
    const layout = placement.kind;
    if (layout !== 'full' && layout !== 'split' && layout !== 'inset') return null;
    const common: LayoutValues = {
      [ElementFieldId.LAYOUT]: LAYOUT_VALUE[layout],
      [ElementFieldId.FIT]: placement.fit === 'contain' ? 'contain' : 'cover',
    };
    if (layout === 'full') return common;
    if (layout === 'split') {
      return {
        ...common,
        [ElementFieldId.CORNER_RADIUS]: this.hundredths(this.clamped(placement.cornerRadius, RANGES.cornerRadius!, FRESH_SPLIT.cornerRadius)),
        [ElementFieldId.PADDING]: this.hundredths(this.clamped(placement.padding, RANGES.splitPadding!, FRESH_SPLIT.padding)),
        [ElementFieldId.SPLIT_SIDE]: placement.assetSide === 'end' ? '1' : '0',
        [ElementFieldId.SPLIT_RATIO]: this.clamped(placement.assetRatio, RANGES.splitAssetRatio!, FRESH_SPLIT.assetRatio),
      };
    }
    const aspectRatio = typeof placement.aspectRatio === 'number' && Number.isFinite(placement.aspectRatio)
      ? this.clamped(placement.aspectRatio, RANGES.aspectRatio!, 1)
      : null;
    return {
      ...common,
      [ElementFieldId.CORNER_RADIUS]: this.hundredths(this.clamped(placement.cornerRadius, RANGES.cornerRadius!, FRESH_INSET.cornerRadius)),
      [ElementFieldId.PADDING]: this.hundredths(this.clamped(placement.padding, RANGES.insetPadding!, FRESH_INSET.padding)),
      [ElementFieldId.CENTER_X]: this.clamped(placement.centerX, RANGES.center!, FRESH_INSET.centerX),
      [ElementFieldId.CENTER_Y]: this.clamped(placement.centerY, RANGES.center!, FRESH_INSET.centerY),
      [ElementFieldId.WIDTH]: this.clamped(placement.width, RANGES.insetWidth!, FRESH_INSET.width),
      ...(aspectRatio === null ? {} : { [ElementFieldId.ASPECT_RATIO]: aspectRatio }),
    };
  }

  private clamped(value: unknown, range: Range, fresh: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fresh;
    return Math.min(range.max, Math.max(range.min, value));
  }

  // Without the float noise a multiplication leaves.
  private hundredths(fraction: number): number {
    return Number((fraction * 100).toFixed(4));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
