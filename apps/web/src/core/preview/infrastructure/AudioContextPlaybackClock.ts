import type { PlaybackClock } from '@core/preview/domain/PlaybackClock';

/**
 * {@link PlaybackClock} anchored on an {@link AudioContext}'s
 * sample-accurate timeline. Reports the current output position
 * in seconds, scaling wall-time by the configured playback rate.
 */
export class AudioContextPlaybackClock implements PlaybackClock {

  private anchorOutputSec = 0;
  private anchorAudioContextSec = 0;
  private running = false;
  private rate = 1;

  constructor(private readonly audioContext: AudioContext) {}

  play(fromOutputSec: number): void {
    this.anchorOutputSec = fromOutputSec;
    this.anchorAudioContextSec = this.audioContext.currentTime;
    this.running = true;
  }

  pause(): void {
    if (!this.running) return;
    this.anchorOutputSec = this.currentOutputTimeSec();
    this.running = false;
  }

  seek(toOutputSec: number): void {
    this.anchorOutputSec = toOutputSec;
    this.anchorAudioContextSec = this.audioContext.currentTime;
  }

  setRate(rate: number): void {
    const safeRate = Math.max(0.01, rate);
    if (this.running) {
      this.anchorOutputSec = this.currentOutputTimeSec();
      this.anchorAudioContextSec = this.audioContext.currentTime;
    }
    this.rate = safeRate;
  }

  isRunning(): boolean {
    return this.running;
  }

  getRate(): number {
    return this.rate;
  }

  currentOutputTimeSec(): number {
    if (!this.running) return this.anchorOutputSec;
    const elapsedWall = this.audioContext.currentTime - this.anchorAudioContextSec;
    return this.anchorOutputSec + elapsedWall * this.rate;
  }

  audioContextTimeForOutputTime(outputSec: number): number {
    if (!this.running) return this.audioContext.currentTime;
    return this.anchorAudioContextSec + (outputSec - this.anchorOutputSec) / this.rate;
  }
}
