import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';

/**
 * The shot layers the preview draws, as last built, and the one
 * resolver that answers how each is drawn at a moment — null while none
 * is built. Emits `'change'` on every write. Holds no logic of its own.
 *
 * Whatever shows a shot layer where the preview shows it asks this
 * resolver, so one moment is resolved once however many ask about it,
 * and nothing can show a layer as the preview no longer draws it.
 */
export class ShotLayerPreviewFootageStore extends EventTarget {
  private footage: PreviewFootage | null = null;

  snapshot(): PreviewFootage | null {
    return this.footage;
  }

  set(footage: PreviewFootage | null): void {
    if (footage === this.footage) return;
    this.footage = footage;
    this.dispatchEvent(new Event('change'));
  }
}
