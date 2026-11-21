import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';

/**
 * The one place a layer is checked, for what is read back from storage
 * and for what an edit writes alike.
 */
export class ShotLayerSanitizer {
  private readonly graphics = new GraphicSanitizer();

  /**
   * `value` as a layer that can be trusted, or null when it names no id,
   * or neither an asset nor a graphic that can be read. Anything else
   * that cannot be read falls back rather than losing what the user
   * picked: a bad start to the asset's start, a bad stop to its own end,
   * a shot to show through that is no name to its own shot.
   */
  sanitize(value: unknown): ShotLayer | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    const id = raw['id'];
    if (typeof id !== 'string' || id === '') return null;
    const run = this.runOf(raw);
    if ('graphic' in raw) {
      const graphic = this.graphics.sanitize(raw['graphic']);
      return graphic === null ? null : { id, graphic, ...run };
    }
    const mediaId = raw['mediaId'];
    if (typeof mediaId !== 'string' || mediaId === '') return null;
    const inSec = this.isFiniteNumber(raw['inSec']) && raw['inSec'] >= 0 ? raw['inSec'] : 0;
    const outSec = this.isFiniteNumber(raw['outSec']) && raw['outSec'] > inSec ? raw['outSec'] : null;
    return {
      id,
      mediaId,
      inSec,
      outSec,
      loop: raw['loop'] === true,
      ...run,
    };
  }

  /** The shot the layer is said to show through, where it names one; whether that shot is there is the partition's to say. */
  private runOf(raw: Record<string, unknown>): { throughShotId?: string } {
    const throughShotId = raw['throughShotId'];
    return typeof throughShotId === 'string' && throughShotId !== '' ? { throughShotId } : {};
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
