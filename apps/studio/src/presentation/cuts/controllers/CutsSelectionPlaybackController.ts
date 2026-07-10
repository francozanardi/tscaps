import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutsEditingController } from '@presentation/cuts/controllers/CutsEditingController';

// After the auto-pause at the selection's upper bound, the browser
// can snap `currentTime` to the start of the decoded frame, which
// is usually a frame below the requested `endSec`. Treating any
// position within this window as "at the end" makes the next play
// restart from the selection start instead of leaking forward by
// a few ms and immediately auto-pausing again.
const UPPER_BOUND_SNAP_TOLERANCE_SEC = 0.05;

// Difference between expected and actual media time, in seconds,
// above which a `timechange` event is treated as an external seek
// rather than natural advance. The threshold sits well above the
// per-frame jitter (~33ms at 30fps) and well below any meaningful
// user-initiated jump.
const SEEK_DETECTION_TOLERANCE_SEC = 0.1;

// During the final stretch before the deadline, the pause check
// runs in a `setTimeout(fn, 0)` loop (browser-clamped to ~4ms)
// instead of waiting for a single long timer that fires with
// ~10–15ms of OS scheduling jitter. The window must comfortably
// cover that jitter so a delayed long timer still lands inside
// the refinement loop.
const REFINEMENT_WINDOW_MS = 30;

/**
 * Constrains video playback to the in-progress cuts selection. When
 * the selection's upper bound is reached while playing, playback is
 * paused and the head is rewound to the selection start so the next
 * play press resumes from inside the active range without any
 * race against `<video>.play()` warm-up. When playback transitions
 * to playing while the head is outside the selection (e.g., after
 * a manual scrub), the head is seeked to the selection start as a
 * safety net.
 *
 * Two cuts run in parallel: a setTimeout-driven `pause + seek` of
 * the video element, and a sample-accurate audio mute scheduled on
 * the audio rendering clock via the injected `scheduleAudioMute`
 * callback. The audio cut is what the user actually hears at the
 * exact moment `endSec` is reached; the video pause follows a few
 * milliseconds later, imperceptibly. Both schedules are recomputed
 * when selection, play state, playback rate, or head position
 * (external seek) change.
 *
 * Without a selection the controller is inert. While stopped, no
 * constraint is enforced and the video plays normally.
 */
export class CutsSelectionPlaybackController {

  private _lastIsPlaying = false;
  private _lastPlaybackRate = 1;
  private _autoPauseTimer: number | null = null;
  private _scheduledFromMediaTimeSec = 0;
  private _scheduledAtWallMs = 0;
  private _deadlineWallMs = 0;
  private _waitingForFirstPlayingTick = false;
  private _headAtPlayStartSec = 0;

  constructor(
    private readonly store: EditorStore,
    private readonly editing: CutsEditingController,
    private readonly seek: (timeSec: number) => void,
    private readonly pause: () => void,
    private readonly scheduleAudioMuteAt: (sourceTimeSec: number) => void,
    private readonly cancelScheduledAudioMute: () => void,
  ) {}

  start(): void {
    const { isPlaying, playbackRate } = this.store.snapshot().video;
    this._lastIsPlaying = isPlaying;
    this._lastPlaybackRate = playbackRate;
    this.store.addEventListener('timechange', this.onTimeChange);
    this.store.addEventListener('change', this.onStateChange);
    this.editing.addEventListener('change', this.onSelectionChange);
    this.rescheduleAutoPause();
  }

  stop(): void {
    this.store.removeEventListener('timechange', this.onTimeChange);
    this.store.removeEventListener('change', this.onStateChange);
    this.editing.removeEventListener('change', this.onSelectionChange);
    this.clearAutoPauseTimer();
    this.cancelScheduledAudioMute();
  }

  private readonly onTimeChange = (): void => {
    if (this._waitingForFirstPlayingTick) {
      this.maybeConsumeFirstPlayingTick();
      return;
    }
    if (this._autoPauseTimer === null) return;
    const { currentTime, playbackRate } = this.store.snapshot().video;
    const elapsedSec = (performance.now() - this._scheduledAtWallMs) / 1000;
    const expected = this._scheduledFromMediaTimeSec + elapsedSec * playbackRate;
    if (Math.abs(currentTime - expected) > SEEK_DETECTION_TOLERANCE_SEC) {
      this.rescheduleAutoPause();
    }
  };

  private readonly onStateChange = (): void => {
    const { isPlaying, currentTime, playbackRate } = this.store.snapshot().video;
    const justStarted = !this._lastIsPlaying && isPlaying;
    const rateChanged = this._lastPlaybackRate !== playbackRate;
    this._lastIsPlaying = isPlaying;
    this._lastPlaybackRate = playbackRate;
    if (justStarted) {
      this.armForFirstPlayingTick(currentTime);
      return;
    }
    if (rateChanged || !isPlaying) this.rescheduleAutoPause();
  };

  private armForFirstPlayingTick(currentTime: number): void {
    this.snapHeadIntoSelection(currentTime);
    this.clearAutoPauseTimer();
    this.cancelScheduledAudioMute();
    this._waitingForFirstPlayingTick = true;
    this._headAtPlayStartSec = this.store.snapshot().video.currentTime;
  }

  private maybeConsumeFirstPlayingTick(): void {
    const { isPlaying, currentTime } = this.store.snapshot().video;
    if (!isPlaying) {
      this._waitingForFirstPlayingTick = false;
      return;
    }
    if (currentTime <= this._headAtPlayStartSec) return;
    this._waitingForFirstPlayingTick = false;
    this.rescheduleAutoPause();
  }

  private readonly onSelectionChange = (): void => {
    this.rescheduleAutoPause();
  };

  private snapHeadIntoSelection(currentTime: number): void {
    const selection = this.editing.selection;
    if (!selection) return;
    const upperBound = selection.endSec - UPPER_BOUND_SNAP_TOLERANCE_SEC;
    if (currentTime >= selection.startSec && currentTime < upperBound) return;
    this.seek(selection.startSec);
  }

  private rescheduleAutoPause(): void {
    this.clearAutoPauseTimer();
    this.cancelScheduledAudioMute();
    const selection = this.editing.selection;
    if (!selection) return;
    const { isPlaying, currentTime, playbackRate } = this.store.snapshot().video;
    if (!isPlaying) return;
    if (currentTime >= selection.endSec) {
      this.pauseAndRewindToStart();
      return;
    }
    const rate = Math.max(0.01, playbackRate);
    const remainingSec = (selection.endSec - currentTime) / rate;
    const now = performance.now();
    this._scheduledFromMediaTimeSec = currentTime;
    this._scheduledAtWallMs = now;
    this._deadlineWallMs = now + remainingSec * 1000;
    this.scheduleAudioMuteAt(selection.endSec);
    this.scheduleNextDeadlineTick();
  }

  private scheduleNextDeadlineTick(): void {
    const remainingMs = this._deadlineWallMs - performance.now();
    const delayMs = Math.max(0, remainingMs - REFINEMENT_WINDOW_MS);
    this._autoPauseTimer = window.setTimeout(this.onDeadlineTick, delayMs);
  }

  private readonly onDeadlineTick = (): void => {
    this._autoPauseTimer = null;
    if (performance.now() >= this._deadlineWallMs) {
      this.pauseAndRewindToStart();
      return;
    }
    this.scheduleNextDeadlineTick();
  };

  private pauseAndRewindToStart(): void {
    const selection = this.editing.selection;
    if (!selection) return;
    this.pause();
    this.seek(selection.startSec);
    this.cancelScheduledAudioMute();
  }

  private clearAutoPauseTimer(): void {
    if (this._autoPauseTimer === null) return;
    window.clearTimeout(this._autoPauseTimer);
    this._autoPauseTimer = null;
  }
}
