import type { RenderTimeMap } from '@tscaps/engine';
import type { AudioScheduleClock } from '@core/preview/domain/AudioScheduleClock';

/** Where a moment of the output was seen on the audio context's timeline, and at which rate. */
interface ClockAnchor {
  readonly outputSec: number;
  readonly contextSec: number;
  readonly rate: number;
}

/**
 * {@link AudioScheduleClock} for a media element that keeps its own time:
 * its playhead, read as output time through the cuts as they stand,
 * matched with an audio context's time.
 *
 * The match is an estimate, held while it stays within
 * {@link DRIFT_TOLERANCE_SEC} of the playhead so that sound scheduled
 * in pieces lands without gaps; when the playhead moves further from it
 * — a seek, a stall, a rate change — it is taken again from where the
 * playhead is.
 */
export class MediaElementAudioScheduleClock implements AudioScheduleClock {
  static readonly DRIFT_TOLERANCE_SEC = 0.05;

  private anchor: ClockAnchor | null = null;

  constructor(
    private readonly element: HTMLMediaElement,
    private readonly context: BaseAudioContext,
    private readonly readTimeMap: () => RenderTimeMap,
  ) {}

  isRunning(): boolean {
    return !this.element.paused;
  }

  currentOutputTimeSec(): number {
    return this.readTimeMap().toOutputTime(this.element.currentTime);
  }

  getRate(): number {
    return this.element.playbackRate;
  }

  audioContextTimeForOutputTime(outputSec: number): number {
    const now = this.context.currentTime;
    if (!this.isRunning()) {
      this.anchor = null;
      return now;
    }
    const anchor = this.anchorAt(now);
    return anchor.contextSec + (outputSec - anchor.outputSec) / anchor.rate;
  }

  private anchorAt(contextSec: number): ClockAnchor {
    const observedSec = this.currentOutputTimeSec();
    const rate = this.getRate();
    const held = this.anchor;
    if (held !== null && held.rate === rate) {
      const expectedSec = held.outputSec + (contextSec - held.contextSec) * rate;
      if (Math.abs(expectedSec - observedSec) <= MediaElementAudioScheduleClock.DRIFT_TOLERANCE_SEC) return held;
    }
    this.anchor = { outputSec: observedSec, contextSec, rate };
    return this.anchor;
  }
}
