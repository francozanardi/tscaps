import type { RenderTimeMap } from '@tscaps/engine';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';

/** Reads a media element's playhead as output time, through the cuts as they stand when read. */
export class MediaElementPlaybackTimeSource implements PlaybackTimeSource {
  constructor(
    private readonly element: HTMLMediaElement,
    private readonly readTimeMap: () => RenderTimeMap,
  ) {}

  isRunning(): boolean {
    return !this.element.paused;
  }

  currentOutputTimeSec(): number {
    return this.readTimeMap().toOutputTime(this.element.currentTime);
  }
}
