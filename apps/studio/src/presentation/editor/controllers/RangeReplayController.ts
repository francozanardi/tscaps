/** Where the playhead is and what it is doing, read at the moment a replay is asked for. */
export interface PlayheadReader {
  isPlaying(): boolean;
  timeSec(): number;
}

/**
 * Plays one stretch of the video once, from its start, and comes to
 * rest exactly on its end: without sound, unless asked for it.
 *
 * For watching something happen again: a caption arriving, a word being
 * narrated, silently; a cut whose sound is part of what is being
 * judged, with it. It rests where the stretch ends rather than rewinding,
 * since that frame is what the stretch settles into.
 *
 * **A video the user is playing is left alone.** Seizing the playhead
 * from someone watching their own video is the opposite of showing them
 * something, and what they changed is already on screen in front of
 * them. Its own replay does not count as being in the way, so asking
 * again while one is running starts the new stretch over.
 *
 * Where the stop lands is decided against the clock the frames are
 * painted on, so it does not depend on how the machine was behaving
 * that second. There is nothing to cancel either: the bound belongs to
 * the playback now running, and outlives whoever asked for it.
 */
export class RangeReplayController {
  private lastPlayed: ReplayedRange | null = null;

  constructor(
    private readonly playhead: PlayheadReader,
    private readonly seek: (timeSec: number) => void,
    private readonly play: () => void,
    private readonly scheduleStopAt: (sourceTimeSec: number) => void,
    private readonly scheduleAudioMuteAt: (sourceTimeSec: number) => void,
    private readonly cancelScheduledAudioMute: () => void,
  ) {}

  /** Starts the stretch over, unless the video is playing for someone else; with its sound where `withSound` says. */
  replay(startSec: number, endSec: number, withSound = false): void {
    if (endSec <= startSec) return;
    if (this.playingForSomeoneElse()) return;
    this.start(startSec, endSec, withSound);
  }

  /**
   * Plays the stretch from its start, with its sound, whatever the
   * video was doing. For a stretch the user asked to watch by name,
   * which is the one case where taking the playhead is what they meant.
   */
  playThrough(startSec: number, endSec: number): void {
    if (endSec <= startSec) return;
    this.start(startSec, endSec, true);
  }

  private start(startSec: number, endSec: number, withSound: boolean): void {
    // Seeking drops whatever bound was standing, so the new one is asked
    // for after it. Silence runs from the stretch's own start, not now.
    this.seek(startSec);
    this.scheduleStopAt(endSec);
    if (withSound) this.cancelScheduledAudioMute();
    else this.scheduleAudioMuteAt(startSec);
    this.play();
    this.lastPlayed = { startSec, endSec };
  }

  /**
   * A paused video is nobody's. A playing one is its own only while the
   * playhead is still inside the stretch it last put it in, which is as
   * close as anything gets to asking whether the playback now running
   * is the one it started.
   */
  private playingForSomeoneElse(): boolean {
    if (!this.playhead.isPlaying()) return false;
    if (this.lastPlayed === null) return true;
    const now = this.playhead.timeSec();
    return now < this.lastPlayed.startSec || now >= this.lastPlayed.endSec;
  }
}

/** A stretch of source time, in seconds. */
interface ReplayedRange {
  readonly startSec: number;
  readonly endSec: number;
}
