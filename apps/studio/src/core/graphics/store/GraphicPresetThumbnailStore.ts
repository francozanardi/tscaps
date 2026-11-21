import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicFilmstrip, GraphicFilmstripRecorder } from '@core/graphics/services/GraphicFilmstripRecorder';

// What a thumbnail loops over: the first seconds, where presets come in and settle, at a rate a small picture needs.
const LOOP_SEC = 2.4;
const LOOP_FPS = 12;
// The thumbnail's area, in pixels: wide, as a card is. A graphic is drawn at its own shape inside it.
const AREA_WIDTH_PX = 320;
const AREA_HEIGHT_PX = 150;
const MIN_SIDE_PX = 4;

/** Where a preset's thumbnail stands. */
export type GraphicPresetThumbnail =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'ready'; readonly filmstrip: GraphicFilmstrip }
  | { readonly kind: 'failed' };

const WAITING: GraphicPresetThumbnail = { kind: 'waiting' };

/**
 * A loop of each preset, recorded once on first asking and kept for as
 * long as the editor is open: presets do not change while it runs.
 * Recordings run one at a time, in the order asked, so opening the
 * presets costs one graphic at a time however many cards ask at once.
 * A preset that cannot be played reads as failed and is not tried again.
 *
 * Each loop is drawn at the preset's own shape, as large as fits a wide
 * card's area. Subscribers hear every thumbnail that lands.
 *
 * A thumbnail asked for something that may stop being shown for good (a
 * graphic as it is now, a preset since deleted) is given back with
 * {@link release}.
 */
export class GraphicPresetThumbnailStore {
  private readonly held = new Map<string, GraphicPresetThumbnail>();
  private readonly listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly recorder: GraphicFilmstripRecorder) {}

  /** Where `preset`'s thumbnail stands, asking for it the first time. */
  thumbnailOf(preset: GraphicPreset): GraphicPresetThumbnail {
    const held = this.held.get(preset.id);
    if (held !== undefined) return held;
    this.held.set(preset.id, WAITING);
    this.queue = this.queue.then(() => this.record(preset));
    return WAITING;
  }

  /**
   * Forgets `presetId`'s thumbnail and frees its pictures; one still being
   * recorded is dropped when it lands. Subscribers hear it, so a card still
   * showing it asks again, which records it again.
   */
  release(presetId: string): void {
    const held = this.held.get(presetId);
    if (held === undefined) return;
    this.held.delete(presetId);
    if (held.kind === 'ready') for (const frame of held.filmstrip.frames) frame.close();
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async record(preset: GraphicPreset): Promise<void> {
    const { widthPx, heightPx } = this.sizeOf(preset.graphic.aspectRatio);
    if (this.held.get(preset.id) !== WAITING) return;
    try {
      const filmstrip = await this.recorder.record(preset.graphic, widthPx, heightPx, LOOP_SEC, LOOP_FPS);
      if (this.held.get(preset.id) !== WAITING) {
        for (const frame of filmstrip.frames) frame.close();
        return;
      }
      this.held.set(preset.id, { kind: 'ready', filmstrip });
    } catch (error) {
      console.error(`[graphics] the preset ${preset.id} could not be recorded for its thumbnail`, error);
      if (this.held.get(preset.id) !== WAITING) return;
      this.held.set(preset.id, { kind: 'failed' });
    }
    for (const listener of this.listeners) listener();
  }

  /** The largest size of `aspectRatio` that fits the thumbnail's area. */
  private sizeOf(aspectRatio: number): { widthPx: number; heightPx: number } {
    const widthPx = Math.min(AREA_WIDTH_PX, AREA_HEIGHT_PX * aspectRatio);
    return { widthPx: Math.max(MIN_SIDE_PX, Math.round(widthPx)), heightPx: Math.max(MIN_SIDE_PX, Math.round(widthPx / aspectRatio)) };
  }
}
