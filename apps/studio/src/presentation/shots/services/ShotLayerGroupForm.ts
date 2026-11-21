import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type {
  ShotLayerPlacementPatch,
  ShotLayerPlacementSettings,
} from '@core/shots/domain/ShotLayerPatch';
import type { ShotLayerPlacement, ShotLayerPlacementKind } from '@core/shots/domain/ShotLayerPlacement';

/** A field of the form several layers are edited through: the layout, one of its settings, or one of the stretch's. */
export type ShotLayerGroupField = 'layout' | keyof ShotLayerPlacementSettings | 'inSec' | 'outSec' | 'loop';

const STRETCH_FIELDS = ['inSec', 'outSec', 'loop'] as const;

/** One of the layers edited together: the layer, and the layout its fields hold. */
export interface ShotLayerGroupMember {
  readonly layer: ShotLayer;
  readonly placement: ShotLayerPlacement;
}

// Settings a layout holds only once given: what fills the box, where the file is cropped.
const OPTIONAL_SETTINGS: ReadonlySet<string> = new Set(['backdrop', 'position']);

/**
 * The way several layers are edited through one form: the form shows
 * the first layer's values, marks the fields where the others hold
 * something else, and a change becomes a patch of only what changed —
 * never the first layer's whole placement copied onto the rest.
 *
 * The form itself is the one a single layer is edited through, which
 * hands back a whole placement on every change; this is what reads the
 * change back out of it.
 */
export class ShotLayerGroupForm {
  /** The fields where some layer of `members` holds a value other than the first's. */
  mixedFields(members: ReadonlyArray<ShotLayerGroupMember>): ReadonlySet<ShotLayerGroupField> {
    const [first, ...rest] = members;
    const mixed = new Set<ShotLayerGroupField>();
    if (first === undefined) return mixed;
    for (const other of rest) {
      for (const field of this.placementFieldsDiffering(first.placement, other.placement)) mixed.add(field);
      for (const field of STRETCH_FIELDS) if (this.stretchOf(first.layer, field) !== this.stretchOf(other.layer, field)) mixed.add(field);
    }
    return mixed;
  }

  /** The layouts `members` are in, each once. */
  layoutsOf(members: ReadonlyArray<ShotLayerGroupMember>): ReadonlySet<ShotLayerPlacementKind> {
    return new Set(members.map((member) => member.placement.kind));
  }


  /**
   * What changed from `shown` to `edited`, as a patch: the new layout
   * alone where the layout changed (a layer switching to it starts from
   * its fresh settings, as one edited alone would), and otherwise every
   * setting that differs. Null where nothing did.
   */
  placementPatch(shown: ShotLayerPlacement, edited: ShotLayerPlacement): ShotLayerPlacementPatch | null {
    if (shown.kind !== edited.kind) return { layout: edited.kind };
    const settings: Record<string, unknown> = {};
    const editedSettings = edited as unknown as Readonly<Record<string, unknown>>;
    for (const field of this.placementFieldsDiffering(shown, edited)) settings[field] = editedSettings[field];
    if (Object.keys(settings).length === 0) return null;
    return { settings: settings as Partial<ShotLayerPlacementSettings> };
  }

  /**
   * The layout where it differs, and every setting both layouts hold
   * whose values differ, or that every layout may hold and only one of
   * them does (what fills the box, where the file is cropped).
   */
  private placementFieldsDiffering(first: ShotLayerPlacement, second: ShotLayerPlacement): ShotLayerGroupField[] {
    const firstSettings = first as unknown as Readonly<Record<string, unknown>>;
    const secondSettings = second as unknown as Readonly<Record<string, unknown>>;
    const fields = new Set([...Object.keys(firstSettings), ...Object.keys(secondSettings)]);
    const settings = [...fields]
      .filter((field) => field !== 'kind')
      .filter((field) => OPTIONAL_SETTINGS.has(field) || (field in firstSettings && field in secondSettings))
      .filter((field) => JSON.stringify(firstSettings[field]) !== JSON.stringify(secondSettings[field]))
      .map((field) => field as ShotLayerGroupField);
    return first.kind === second.kind ? settings : ['layout', ...settings];
  }

  /** `field` of `layer`'s stretch; a graphic, which has none, holds nothing. */
  private stretchOf(layer: ShotLayer, field: typeof STRETCH_FIELDS[number]): number | boolean | null | undefined {
    return 'mediaId' in layer ? layer[field] : undefined;
  }
}
