import type { GraphicBox } from '@core/graphics/domain/GraphicBox';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import { GRAPHIC_PRESET_CATEGORIES, type GraphicPresetCategory } from '@core/graphics/domain/GraphicPresetCategory';
import type { GraphicPresetAnimation, GraphicPresetMotion } from '@core/graphics/domain/GraphicPresetMotion';
import type { GraphicPresetSound, GraphicPresetSoundSpot } from '@core/graphics/domain/GraphicPresetSound';
import type { GraphicPresetStyleReader } from '@core/graphics/domain/GraphicPresetStyleReader';
import type { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';

const MAX_NAME_CHARS = 60;
// How far from its spot a sound may start, either way, in seconds.
const MAX_OFFSET_SEC = 10;

/**
 * Reads a preset from its manifest, the format `presets/graphics/AUTHORING.md`
 * describes, which a person, a model and a saved preset all write: `id`,
 * `name`, `description`, `category`, `aspectRatio`, `box`, `motion`,
 * `sounds`, `fields`, `hidesCaptions` and, for a saved one, the `moments`
 * its code declared and its layer's whole `style`.
 * The document arrives apart, as a shipped preset keeps it in files of its
 * own.
 *
 * The graphic is checked as a stored one is. A manifest without an id, a
 * document or a box it can read gives null; everything else falls back:
 * no name is the id, an unknown category is none, a motion or a sound it
 * cannot read is none.
 */
export class GraphicPresetManifestReader {
  constructor(
    private readonly sanitizer: GraphicSanitizer,
    private readonly styles: GraphicPresetStyleReader,
  ) {}

  read(manifest: unknown, document: unknown): GraphicPreset | null {
    if (typeof manifest !== 'object' || manifest === null) return null;
    const raw = manifest as Record<string, unknown>;
    const id = raw['id'];
    const box = this.boxOf(raw['box']);
    const graphic = this.sanitizer.sanitize({
      document,
      fields: raw['fields'],
      params: {},
      aspectRatio: raw['aspectRatio'],
      moments: raw['moments'],
      presetId: id,
      hidesCaptions: raw['hidesCaptions'],
    });
    if (typeof id !== 'string' || id === '' || graphic === null || box === null) return null;
    const name = typeof raw['name'] === 'string' && raw['name'].trim() !== '' ? raw['name'].trim().slice(0, MAX_NAME_CHARS) : id;
    return {
      id,
      name,
      description: typeof raw['description'] === 'string' ? raw['description'] : '',
      category: this.categoryOf(raw['category']),
      graphic,
      box,
      motion: this.motionOf(raw['motion']),
      sounds: this.soundsOf(raw['sounds']),
      style: this.styles.read(raw['style']),
    };
  }

  private categoryOf(value: unknown): GraphicPresetCategory | null {
    return typeof value === 'string' && Object.hasOwn(GRAPHIC_PRESET_CATEGORIES, value) ? value as GraphicPresetCategory : null;
  }

  /**
   * `motion`: `{ entrance, exit }`, each a layer animation's id, or
   * `{ "animation": id, ...values }` to set its fields; anything else there
   * is none. Values are checked where they are written.
   */
  private motionOf(value: unknown): GraphicPresetMotion {
    const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    return { entrance: this.animationOf(raw['entrance']), exit: this.animationOf(raw['exit']) };
  }

  private animationOf(value: unknown): GraphicPresetAnimation | null {
    if (typeof value === 'string' && value !== '') return { presetId: value, params: {} };
    if (typeof value !== 'object' || value === null) return null;
    const { animation, ...values } = value as Record<string, unknown>;
    if (typeof animation !== 'string' || animation === '') return null;
    const params = Object.fromEntries(Object.entries(values).filter(([, held]) => typeof held === 'number' || typeof held === 'string')) as GraphicPresetAnimation['params'];
    return { presetId: animation, params };
  }

  /**
   * `sounds`: each `{ moment, sound, volume, offset }`, or `{ edge, ... }`
   * with `edge` `"entry"` or `"exit"`, `{ transition, ... }` with
   * `"entrance"` or `"exit"`, or `{ camera: true, ... }` in place of a
   * moment. One naming none, or no sound, is dropped; a volume out of 0–1 is clamped, and
   * so is an offset beyond ten seconds either way.
   */
  private soundsOf(value: unknown): GraphicPresetSound[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry): GraphicPresetSound[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { sound, volume, offset } = entry as Record<string, unknown>;
      const spot = this.spotOf(entry as Record<string, unknown>);
      if (spot === null || typeof sound !== 'string' || sound === '') return [];
      return [{
        spot,
        soundId: sound,
        volume: this.clamped(volume, 0, 1, 1),
        offsetSec: this.clamped(offset, -MAX_OFFSET_SEC, MAX_OFFSET_SEC, 0),
      }];
    });
  }

  private spotOf(entry: Record<string, unknown>): GraphicPresetSoundSpot | null {
    const { moment, edge, transition, camera } = entry;
    if (typeof moment === 'string' && moment !== '') return { kind: 'moment', momentId: moment };
    if (edge === 'entry' || edge === 'exit') return { kind: 'edge', edge };
    if (transition === 'entrance' || transition === 'exit') return { kind: 'transition', edge: transition };
    if (camera === true) return { kind: 'camera' };
    return null;
  }

  private clamped(value: unknown, min: number, max: number, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }

  private boxOf(value: unknown): GraphicBox | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    if (raw['kind'] === 'full') return { kind: 'full' };
    const { centerX, centerY, width } = raw;
    if (raw['kind'] !== 'box' || typeof centerX !== 'number' || typeof centerY !== 'number' || typeof width !== 'number') return null;
    return { kind: 'box', centerX, centerY, width };
  }
}
