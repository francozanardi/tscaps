import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRange } from '@core/cuts/domain/CutRegistry';

// Difference between expected and actual media time, in seconds,
// above which a `timechange` event is treated as an external seek
// rather than natural advance and triggers a re-arm. Sits well
// above per-frame jitter (~33ms at 30fps) and well below any
// meaningful user-initiated jump.
const SEEK_DETECTION_TOLERANCE_SEC = 0.1;

/**
 * Honours committed cuts during preview playback: when the playhead
 * approaches a cut range, the audio is muted on the audio rendering
 * clock at the exact cut start (sample-accurate via the injected
 * `scheduleAudioMute`), and the video is seeked past the cut a few
 * milliseconds later via `setTimeout` (frame-accurate jitter is
 * imperceptible). When the playhead is already inside a cut range
 * at the moment playback resumes — or a manual seek lands inside
 * one — the skip fires immediately.
 *
 * The controller stays active for the whole editor lifetime, not
 * just while the Cuts panel is foregrounded, so cuts are honoured
 * regardless of which tab the user is viewing.
 *
 * While paused, the controller is inert so the user can scrub
 * freely (including into a cut range) without auto-skipping.
 */
export class CutsPlaybackSkipController {

  private _lastIsPlaying = false;
  private _skipTimer: number | null = null;
  private _scheduledFromMediaTimeSec = 0;
  private _scheduledAtWallMs = 0;
  private _waitingForFirstPlayingTick = false;
  private _headAtPlayStartSec = 0;

  constructor(
    private readonly store: EditorStore,
    private readonly seek: (timeSec: number) => void,
    private readonly scheduleAudioMute: (wallClockSec: number) => void,
    private readonly cancelScheduledAudioMute: () => void,
  ) {}

  start(): void {
    this._lastIsPlaying = this.store.snapshot().video.isPlaying;
    this.store.addEventListener('timechange', this.onTimeChange);
    this.store.addEventListener('change', this.onStateChange);
    this.rearm();
  }

  stop(): void {
    this.store.removeEventListener('timechange', this.onTimeChange);
    this.store.removeEventListener('change', this.onStateChange);
    this.clearSkipTimer();
    this.cancelScheduledAudioMute();
  }

  private readonly onTimeChange = (): void => {
    if (this._waitingForFirstPlayingTick) {
      this.maybeConsumeFirstPlayingTick();
      return;
    }
    if (this._skipTimer === null) {
      this.rearm();
      return;
    }
    const { currentTime, playbackRate } = this.store.snapshot().video;
    const elapsedSec = (performance.now() - this._scheduledAtWallMs) / 1000;
    const expected = this._scheduledFromMediaTimeSec + elapsedSec * playbackRate;
    if (Math.abs(currentTime - expected) > SEEK_DETECTION_TOLERANCE_SEC) {
      this.rearm();
    }
  };

  private readonly onStateChange = (): void => {
    const { isPlaying, currentTime } = this.store.snapshot().video;
    const justStarted = !this._lastIsPlaying && isPlaying;
    this._lastIsPlaying = isPlaying;
    if (justStarted) {
      this.armForFirstPlayingTick(currentTime);
      return;
    }
    this.rearm();
  };

  // After a fresh play() the very next tick can still carry the
  // pre-resume timestamp; arming against it would compute a stale
  // remaining time and fire the skip early. We wait for the first
  // tick that actually advances past where play started before
  // arming the next skip.
  private armForFirstPlayingTick(currentTime: number): void {
    this.clearSkipTimer();
    const containing = this.findContainingCut(currentTime);
    if (containing) {
      this.cancelScheduledAudioMute();
      this.seek(containing.endSec);
      return;
    }
    this.cancelScheduledAudioMute();
    this._waitingForFirstPlayingTick = true;
    this._headAtPlayStartSec = currentTime;
  }

  private maybeConsumeFirstPlayingTick(): void {
    const { isPlaying, currentTime } = this.store.snapshot().video;
    if (!isPlaying) {
      this._waitingForFirstPlayingTick = false;
      return;
    }
    if (currentTime <= this._headAtPlayStartSec) return;
    this._waitingForFirstPlayingTick = false;
    this.rearm();
  }

  private rearm(): void {
    this.clearSkipTimer();
    const snapshot = this.store.snapshot();
    if (!snapshot.video.isPlaying) {
      this.cancelScheduledAudioMute();
      return;
    }
    const currentTime = snapshot.video.currentTime;
    const containing = this.findContainingCut(currentTime);
    if (containing) {
      this.cancelScheduledAudioMute();
      this.seek(containing.endSec);
      return;
    }
    const next = this.findNextCutAfter(currentTime);
    if (!next) {
      this.cancelScheduledAudioMute();
      return;
    }
    const rate = Math.max(0.01, snapshot.video.playbackRate);
    const remainingSec = (next.startSec - currentTime) / rate;
    this._scheduledFromMediaTimeSec = currentTime;
    this._scheduledAtWallMs = performance.now();
    this.scheduleAudioMute(remainingSec);
    const skipDestination = next.endSec;
    this._skipTimer = window.setTimeout(() => {
      this._skipTimer = null;
      this.seek(skipDestination);
      this.cancelScheduledAudioMute();
    }, remainingSec * 1000);
  }

  private findContainingCut(timeSec: number): CutRange | null {
    const cuts = this.store.snapshot().cuts.list();
    for (const cut of cuts) {
      if (timeSec >= cut.startSec && timeSec < cut.endSec) return cut;
    }
    return null;
  }

  private findNextCutAfter(timeSec: number): CutRange | null {
    const cuts = this.store.snapshot().cuts.list();
    let best: CutRange | null = null;
    for (const cut of cuts) {
      if (cut.startSec <= timeSec) continue;
      if (best === null || cut.startSec < best.startSec) best = cut;
    }
    return best;
  }

  private clearSkipTimer(): void {
    if (this._skipTimer === null) return;
    window.clearTimeout(this._skipTimer);
    this._skipTimer = null;
  }
}
