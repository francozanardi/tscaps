import type { RenderTimeMap } from '@tscaps/engine';
import type { AudioTimeSpan } from '@core/audio-mix/domain/AudioTimeSpan';
import type { PlayheadReader } from '@presentation/editor/controllers/RangeReplayController';

/** The stretch of source time one effect was last played over, and which effect. */
interface PlayedEffect {
  readonly clipId: string;
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * Plays the video around one sound effect, aloud, so the effect is heard
 * where it lands: from a moment before it starts to a moment after it
 * ends, never less than {@link MIN_PLAY_SEC} in all, then rests. Asked
 * again for the same effect while that playback runs, it stops it.
 *
 * Asking for an effect takes the playhead whatever it was doing; it is
 * what the user asked to see. The stop belongs to the surface's run: a
 * seek or a pause by the user drops it, so once they take the playhead
 * back, playing again runs on unbounded. Silence a replay left
 * scheduled is lifted, since the point is to hear the effect.
 */
export class SoundEffectPlaybackController {
  /** Played before the effect starts, so it is heard arriving. */
  static readonly LEAD_IN_SEC = 0.5;
  /** Played after the effect ends, so its tail is not cut short. */
  static readonly TAIL_SEC = 0.5;
  /** The shortest playback, so a click of a sound still reads as a moment of video. */
  static readonly MIN_PLAY_SEC = 1.5;

  private lastPlayed: PlayedEffect | null = null;

  constructor(
    private readonly playhead: PlayheadReader,
    private readonly seek: (sourceTimeSec: number) => void,
    private readonly play: () => void,
    private readonly pause: () => void,
    private readonly scheduleStopAt: (sourceTimeSec: number) => void,
    private readonly cancelScheduledAudioMute: () => void,
  ) {}

  /**
   * Plays the video around the effect `clipId`, which plays over
   * `heard` in output time, or stops the playback it started for that
   * same effect while it runs. `timeMap` turns output time into the
   * source time the playhead is moved in.
   */
  toggle(clipId: string, heard: AudioTimeSpan, timeMap: RenderTimeMap): void {
    if (this.isPlaying(clipId)) {
      this.pause();
      this.lastPlayed = null;
      return;
    }
    const played = this.playedFor(clipId, heard, timeMap);
    // Seeking drops whatever stop was standing, so the new one is asked for after it.
    this.seek(played.startSec);
    this.scheduleStopAt(played.endSec);
    this.cancelScheduledAudioMute();
    this.play();
    this.lastPlayed = played;
  }

  /**
   * Whether the playback it started for `clipId` is still the one
   * running: the video plays and the playhead has not left the stretch
   * it was put in.
   */
  private isPlaying(clipId: string): boolean {
    const last = this.lastPlayed;
    if (last === null || last.clipId !== clipId || !this.playhead.isPlaying()) return false;
    const now = this.playhead.timeSec();
    return now >= last.startSec && now < last.endSec;
  }

  private playedFor(clipId: string, heard: AudioTimeSpan, timeMap: RenderTimeMap): PlayedEffect {
    const startSec = Math.max(0, heard.startSec - SoundEffectPlaybackController.LEAD_IN_SEC);
    // A file whose length is not known yet has no end to pad; the shortest playback covers it.
    const heardEndSec = Number.isFinite(heard.endSec) ? heard.endSec : heard.startSec;
    const endSec = Math.max(heardEndSec + SoundEffectPlaybackController.TAIL_SEC, startSec + SoundEffectPlaybackController.MIN_PLAY_SEC);
    return { clipId, startSec: timeMap.toSourceTime(startSec), endSec: timeMap.toSourceTime(endSec) };
  }
}
