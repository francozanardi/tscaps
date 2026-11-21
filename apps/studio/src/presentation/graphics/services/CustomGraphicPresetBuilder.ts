import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';

// FNV-1a, 32 bits: a short name for a long text, not a guard against anyone.
const OFFSET_BASIS = 0x811c9dc5;
const PRIME = 0x01000193;

/**
 * A graphic that is no preset, as a card shows it: called *Custom*, drawn
 * with its fields' defaults, and named by what it then looks like — its
 * document, its fields and its shape — so the same look keeps one id and
 * any change to it gets another, but for a collision rare enough to cost
 * no more than a stale thumbnail. The values set on its fields do not
 * change it.
 */
export class CustomGraphicPresetBuilder {
  readonly name = 'Custom';

  presetOf(graphic: Graphic): GraphicPreset {
    return {
      id: `custom:${this.fingerprintOf(graphic)}`,
      name: this.name,
      description: 'This graphic as it is now, which is none of the presets.',
      category: null,
      graphic: { ...graphic, params: {} },
      box: { kind: 'full' },
      motion: { entrance: null, exit: null },
      sounds: [],
    style: null,
    };
  }

  private fingerprintOf(graphic: Graphic): string {
    const text = JSON.stringify([graphic.document, graphic.fields, graphic.aspectRatio]);
    let hash = OFFSET_BASIS;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, PRIME) >>> 0;
    }
    return `${hash.toString(36)}-${text.length.toString(36)}`;
  }
}
