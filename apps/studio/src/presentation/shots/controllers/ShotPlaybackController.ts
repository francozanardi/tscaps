// A shot ends where the next one opens, so resting on its end would
// hand the playhead to the next shot. A sixtieth is the shortest frame
// the editor assumes anywhere, so stopping that far short lands inside
// the shot at any frame rate.
const LAST_FRAME_SEC = 1 / 60;

/**
 * Plays one shot and only that shot: from where it opens, with sound,
 * coming to rest on its last frame.
 *
 * Unlike a replay, it takes the playhead whatever it was doing — asking
 * for a shot is asking for the video to show it — and it plays aloud,
 * lifting any silence a replay left scheduled.
 */
export class ShotPlaybackController {
  constructor(
    private readonly seek: (timeSec: number) => void,
    private readonly play: () => void,
    private readonly scheduleStopAt: (sourceTimeSec: number) => void,
    private readonly cancelScheduledAudioMute: () => void,
  ) {}

  playShot(startSec: number, endSec: number): void {
    if (endSec <= startSec) return;
    // Seeking drops whatever bound was standing, so the new one is asked for after it.
    this.seek(startSec);
    this.scheduleStopAt(Math.max(startSec, endSec - LAST_FRAME_SEC));
    this.cancelScheduledAudioMute();
    this.play();
  }
}
