import type { CutRange } from '@core/cuts/domain/CutRegistry';

// The voice's level is where the loudest twentieth of the audio sits; the room's, where the quietest tenth does.
const VOICE_PERCENTILE = 0.95;
const ROOM_PERCENTILE = 0.1;
// Quiet is this far under the voice, or this far over the room's own noise, whichever is higher.
const QUIET_UNDER_VOICE_DB = 35;
const QUIET_OVER_ROOM_DB = 10;
// A click or a breath this short inside a pause does not end it; quiet must last this long to count.
const BLIP_SEC = 0.03;
// Under this much room between the voice and the quietest sound, something steady (music, noise) sits under the voice.
const STEADY_BACKGROUND_DB = 25;
const SILENT_DB = -100;

/**
 * How loud the source video's audio is over time, read from its peak
 * envelope (one peak per bucket of `1 / peaksPerSecond` seconds), and
 * where it is quiet. "Quiet" is relative to this video: well under the
 * voice and over the room's own noise, so a noisy room and a studio both
 * read right. A level says nothing about what makes the sound: music or
 * noise reads as loud as a word, so loud never means speech. Times are
 * seconds of the source video.
 */
export class AudioLevels {
  private readonly db: Float32Array;
  readonly quietDb: number;
  readonly voiceDb: number;
  private readonly roomDb: number;
  private quiet: boolean[] | null = null;

  constructor(peaks: Float32Array, private readonly peaksPerSecond: number) {
    this.db = peaks.map((peak) => (peak > 0 ? Math.max(SILENT_DB, 20 * Math.log10(peak)) : SILENT_DB));
    const sorted = [...this.db].sort((first, second) => first - second);
    this.voiceDb = this.percentile(sorted, VOICE_PERCENTILE);
    this.roomDb = this.percentile(sorted, ROOM_PERCENTILE);
    this.quietDb = Math.max(this.roomDb + QUIET_OVER_ROOM_DB, this.voiceDb - QUIET_UNDER_VOICE_DB);
  }

  /**
   * Whether steady sound (music, noise) sits under the voice, so close to
   * it that where a word ends cannot be told from the level.
   */
  get hasSteadyBackground(): boolean {
    return this.voiceDb - this.roomDb < STEADY_BACKGROUND_DB;
  }

  /** Whether any of `range` is quiet. */
  hasQuietWithin(range: CutRange): boolean {
    const quiet = this.quietBuckets();
    for (let index = this.indexOf(range.startSec); index < this.indexOf(range.endSec); index += 1) if (quiet[index]) return true;
    return false;
  }

  /** The first time from `fromSec` on, before `untilSec`, where quiet starts and lasts a moment; null when none does. */
  quietStartAfter(fromSec: number, untilSec: number): number | null {
    const quiet = this.quietBuckets();
    const run = this.runBuckets();
    for (let index = this.indexOf(fromSec); index + run <= this.indexOf(untilSec); index += 1) {
      if (quiet.slice(index, index + run).every(Boolean)) return index / this.peaksPerSecond;
    }
    return null;
  }

  /** The last time up to `untilSec`, after `fromSec`, where a moment of quiet ends; null when none does. */
  quietEndBefore(untilSec: number, fromSec: number): number | null {
    const quiet = this.quietBuckets();
    const run = this.runBuckets();
    for (let index = this.indexOf(untilSec); index - run >= this.indexOf(fromSec); index -= 1) {
      if (quiet.slice(index - run, index).every(Boolean)) return index / this.peaksPerSecond;
    }
    return null;
  }

  /** Where the last sound before `sec` ends, looking back no further than `notBeforeSec`; null when it is quiet all that way. */
  soundEndBefore(sec: number, notBeforeSec: number): number | null {
    const quiet = this.quietBuckets();
    for (let index = this.indexOf(sec) - 1; index >= this.indexOf(notBeforeSec); index -= 1) {
      if (!quiet[index]) return (index + 1) / this.peaksPerSecond;
    }
    return null;
  }

  /** Where the first sound from `sec` on starts, looking no further than `notAfterSec`; null when it is quiet all that way. */
  soundStartAfter(sec: number, notAfterSec: number): number | null {
    const quiet = this.quietBuckets();
    for (let index = this.indexOf(sec); index < this.indexOf(notAfterSec); index += 1) {
      if (!quiet[index]) return index / this.peaksPerSecond;
    }
    return null;
  }

  get durationSec(): number {
    return this.db.length / this.peaksPerSecond;
  }

  /** The stretches at least `minSec` long where the audio stays quiet, in time order. */
  quietSpans(minSec: number): CutRange[] {
    const quiet = this.quietBuckets();
    const spans: CutRange[] = [];
    let start: number | null = null;
    for (let index = 0; index <= quiet.length; index += 1) {
      if (index < quiet.length && quiet[index]) {
        if (start === null) start = index;
        continue;
      }
      if (start !== null && (index - start) / this.peaksPerSecond >= minSec) {
        spans.push({ startSec: start / this.peaksPerSecond, endSec: index / this.peaksPerSecond });
      }
      start = null;
    }
    return spans;
  }

  /** How many seconds of `range` are louder than quiet. */
  loudSecWithin(range: CutRange): number {
    let loud = 0;
    for (let index = this.indexOf(range.startSec); index < this.indexOf(range.endSec); index += 1) {
      if (this.db[index]! >= this.quietDb) loud += 1;
    }
    return loud / this.peaksPerSecond;
  }

  /** Whether sound runs across `sec`: the audio is louder than quiet right before it and right after it. */
  soundRunsAcross(sec: number): boolean {
    const span = Math.max(1, Math.round(BLIP_SEC * this.peaksPerSecond));
    const at = this.indexOf(sec);
    const loudIn = (from: number, to: number) => {
      for (let index = Math.max(0, from); index < Math.min(this.db.length, to); index += 1) if (this.db[index]! < this.quietDb) return false;
      return to > from;
    };
    return loudIn(at - span, at) && loudIn(at, at + span);
  }

  /**
   * The level over `range`, one digit per `binSec`: 0 where it is quiet,
   * 1 to 9 from just over quiet to the voice's level and above.
   */
  digits(range: CutRange, binSec: number): string {
    const digits: string[] = [];
    const bins = Math.ceil((range.endSec - range.startSec) / binSec - 1e-9);
    for (let bin = 0; bin < bins; bin += 1) {
      const from = this.indexOf(range.startSec + bin * binSec);
      const to = Math.max(from + 1, this.indexOf(Math.min(range.endSec, range.startSec + (bin + 1) * binSec)));
      digits.push(this.digitOf(this.loudestIn(from, to)));
    }
    return digits.join('');
  }

  private loudestIn(from: number, to: number): number {
    let loudest = SILENT_DB;
    for (let index = from; index < Math.min(to, this.db.length); index += 1) loudest = Math.max(loudest, this.db[index]!);
    return loudest;
  }

  private digitOf(db: number): string {
    if (db < this.quietDb) return '0';
    const share = (db - this.quietDb) / Math.max(1, this.voiceDb - this.quietDb);
    return String(1 + Math.min(8, Math.floor(share * 8)));
  }

  /** Quiet buckets, with loud blips shorter than `BLIP_SEC` between two quiet ones counted as quiet; worked out once. */
  private quietBuckets(): boolean[] {
    this.quiet ??= this.findQuietBuckets();
    return this.quiet;
  }

  private findQuietBuckets(): boolean[] {
    const quiet = Array.from(this.db, (db) => db < this.quietDb);
    const blip = Math.max(1, Math.round(BLIP_SEC * this.peaksPerSecond));
    let index = 0;
    while (index < quiet.length) {
      if (quiet[index]) {
        index += 1;
        continue;
      }
      let end = index;
      while (end < quiet.length && !quiet[end]) end += 1;
      if (index > 0 && end < quiet.length && end - index <= blip) quiet.fill(true, index, end);
      index = end;
    }
    return quiet;
  }

  private runBuckets(): number {
    return Math.max(1, Math.round(BLIP_SEC * this.peaksPerSecond));
  }

  private indexOf(sec: number): number {
    return Math.min(this.db.length, Math.max(0, Math.round(sec * this.peaksPerSecond)));
  }

  private percentile(sorted: ReadonlyArray<number>, share: number): number {
    if (sorted.length === 0) return SILENT_DB;
    return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]!;
  }
}
