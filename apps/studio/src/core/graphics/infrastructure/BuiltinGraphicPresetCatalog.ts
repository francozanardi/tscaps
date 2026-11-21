import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { ShippedGraphicPresetStyleReader } from '@core/graphics/infrastructure/ShippedGraphicPresetStyleReader';
import { GraphicPresetManifestReader } from '@core/graphics/services/GraphicPresetManifestReader';
import { GraphicPresetMatcher } from '@core/graphics/services/GraphicPresetMatcher';

// Each preset is a folder of the repo's `presets/graphics/`: `preset.json` (its name, its family, its fields, its shape, its
// sounds and its box) and its document as `graphic.html`, `graphic.css` and `graphic.js`, the files a person or a model writes a
// graphic as (`presets/graphics/AUTHORING.md`).
const manifests = import.meta.glob('../../../../../../presets/graphics/*/preset.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;
const sources = import.meta.glob('../../../../../../presets/graphics/*/graphic.{html,css,js}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const STARTER_ID = 'lower-third';
const OPENING_STARTER_ID = 'hook-boxed-lines';
const UNORDERED = Number.MAX_SAFE_INTEGER;

/**
 * The graphics shipped with the editor, read once from their folders as
 * their manifests say (`GraphicPresetManifestReader`); a preset that cannot
 * be read is left out. Offered in the order each one's manifest gives; the
 * lower third is the starter, and the text box the one on a first shot.
 */
export class BuiltinGraphicPresetCatalog implements GraphicPresetCatalog {
  private readonly presets: ReadonlyArray<GraphicPreset>;
  private readonly matcher = new GraphicPresetMatcher();

  constructor() {
    const reader = new GraphicPresetManifestReader(new GraphicSanitizer(), new ShippedGraphicPresetStyleReader());
    this.presets = Object.entries(manifests)
      .flatMap(([path, manifest]) => {
        const folder = path.slice(0, -'preset.json'.length);
        const document = { html: sources[`${folder}graphic.html`], css: sources[`${folder}graphic.css`], js: sources[`${folder}graphic.js`] };
        const preset = reader.read(manifest, document);
        return preset === null ? [] : [{ order: this.orderOf(manifest), preset }];
      })
      .sort((first, second) => first.order - second.order)
      .map(({ preset }) => preset);
  }

  list(): ReadonlyArray<GraphicPreset> {
    return this.presets;
  }

  starter(): GraphicPreset {
    const starter = this.presets.find((preset) => preset.id === STARTER_ID) ?? this.presets[0];
    if (starter === undefined) throw new Error('No graphic preset could be read.');
    return starter;
  }

  openingStarter(): GraphicPreset {
    return this.presets.find((preset) => preset.id === OPENING_STARTER_ID) ?? this.starter();
  }

  presetOf(graphic: Graphic): GraphicPreset | null {
    return this.matcher.presetOf(this.presets, graphic);
  }

  originOf(graphic: Graphic): GraphicPreset | null {
    return this.matcher.originOf(this.presets, graphic);
  }

  private orderOf(manifest: unknown): number {
    const order = typeof manifest === 'object' && manifest !== null ? (manifest as Record<string, unknown>)['order'] : undefined;
    return typeof order === 'number' ? order : UNORDERED;
  }
}
