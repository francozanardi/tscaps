import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { RenderTimeMap } from '@tscaps/engine';

/**
 * Owns the timeline slider's `value`/`max` and the time-display
 * element's text content, keeping both in sync with playback
 * position and duration **after cuts are applied** — the slider
 * presents an output timeline where each committed cut collapses
 * to a single point, so the slider can't land inside one and the
 * displayed total shrinks as cuts grow.
 *
 * The underlying `<video>` element keeps running on source time;
 * the binder only translates at the UI boundary. Consumers that
 * receive a slider value back (drag/click seeks) must round-trip
 * it through {@link sourceTimeForOutput} before passing it to the
 * playback seek API.
 *
 * Subscribes to the store's `timechange` for frame-rate updates
 * and to `change` for duration loads and cuts edits. The
 * controller is the sole writer of these DOM properties on the
 * bound elements; the caller mounts them once with no `value` and
 * no text content, then registers them.
 */
export class PlaybackTimeBinder {
  private sliderElement: HTMLInputElement | null = null;
  private displayElement: HTMLElement | null = null;
  private running = false;
  private lastAppliedOutputDuration = Number.NaN;
  private cachedCutsRef: CutRegistry | null = null;
  private cachedTimeMap = new RenderTimeMap([]);

  constructor(private readonly store: EditorStore) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.store.addEventListener('timechange', this.onTimeChange);
    this.store.addEventListener('change', this.onStoreChange);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.store.removeEventListener('timechange', this.onTimeChange);
    this.store.removeEventListener('change', this.onStoreChange);
    this.sliderElement = null;
    this.displayElement = null;
  }

  bindSlider(element: HTMLInputElement): () => void {
    this.sliderElement = element;
    this.lastAppliedOutputDuration = Number.NaN;
    this.applySlider();
    return () => {
      if (this.sliderElement === element) this.sliderElement = null;
    };
  }

  bindTimeDisplay(element: HTMLElement): () => void {
    this.displayElement = element;
    this.applyTimeDisplay();
    return () => {
      if (this.displayElement === element) this.displayElement = null;
    };
  }

  /**
   * Translates an output-time slider value back into a source-time
   * position safe to pass to the video element. An output value
   * that lands exactly on a collapsed cut window resolves to the
   * window's right-hand source side, so playback resumes just
   * after the cut.
   */
  sourceTimeForOutput(outputTimeSec: number): number {
    return this.timeMap().toSourceTime(outputTimeSec);
  }

  private readonly onTimeChange = (): void => {
    this.applySlider();
    this.applyTimeDisplay();
  };

  private readonly onStoreChange = (): void => {
    this.applySlider();
    this.applyTimeDisplay();
  };

  private applySlider(): void {
    const element = this.sliderElement;
    if (!element) return;
    const timeMap = this.timeMap();
    const { duration, currentTime } = this.store.snapshot().video;
    const outputDuration = Math.max(0, duration - timeMap.totalSkipDuration());
    if (this.lastAppliedOutputDuration !== outputDuration) {
      element.max = String(outputDuration || 100);
      this.lastAppliedOutputDuration = outputDuration;
    }
    element.value = String(timeMap.toOutputTime(currentTime));
  }

  private applyTimeDisplay(): void {
    const element = this.displayElement;
    if (!element) return;
    const timeMap = this.timeMap();
    const { duration, currentTime } = this.store.snapshot().video;
    const outputDuration = Math.max(0, duration - timeMap.totalSkipDuration());
    const outputTime = timeMap.toOutputTime(currentTime);
    element.textContent = `${formatPlaybackTime(outputTime)} / ${formatPlaybackTime(outputDuration)}`;
  }

  private timeMap(): RenderTimeMap {
    const currentCuts = this.store.snapshot().cuts;
    if (currentCuts !== this.cachedCutsRef) {
      this.cachedCutsRef = currentCuts;
      this.cachedTimeMap = new RenderTimeMap(currentCuts.list());
    }
    return this.cachedTimeMap;
  }
}

function formatPlaybackTime(timeS: number): string {
  const mins = Math.floor(timeS / 60);
  const secs = Math.floor(timeS % 60);
  const ms = Math.floor((timeS % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
