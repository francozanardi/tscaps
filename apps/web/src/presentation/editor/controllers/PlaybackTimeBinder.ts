import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Owns the timeline slider's `value`/`max` and the time-display
 * element's text content, keeping both in sync with playback time
 * and duration. Subscribes to the store's `timechange` for the
 * frame-rate updates and to `change` for duration loads.
 *
 * Ownership contract: the controller is the sole writer of these
 * DOM properties on the bound elements. The caller mounts them
 * once with no `value` and no text content, then registers them.
 */
export class PlaybackTimeBinder {
  private sliderElement: HTMLInputElement | null = null;
  private displayElement: HTMLElement | null = null;
  private running = false;
  private lastAppliedDurationOnSlider = Number.NaN;

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
    this.lastAppliedDurationOnSlider = Number.NaN;
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
    const { duration, currentTime } = this.store.snapshot().video;
    if (this.lastAppliedDurationOnSlider !== duration) {
      element.max = String(duration || 100);
      this.lastAppliedDurationOnSlider = duration;
    }
    element.value = String(currentTime);
  }

  private applyTimeDisplay(): void {
    const element = this.displayElement;
    if (!element) return;
    const { duration, currentTime } = this.store.snapshot().video;
    element.textContent = `${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`;
  }
}

function formatPlaybackTime(timeS: number): string {
  const mins = Math.floor(timeS / 60);
  const secs = Math.floor(timeS % 60);
  const ms = Math.floor((timeS % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
