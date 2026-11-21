/**
 * Routes the audio output of an `HTMLMediaElement` through a Web
 * Audio graph so consumers can schedule sample-accurate gain
 * changes on the audio rendering clock:
 *
 *   media element → MediaElementAudioSourceNode → input GainNode → output GainNode → destination
 *
 * The media element's own `volume` is left untouched; level control
 * is expressed on the output gain node. That keeps volume changes and
 * scheduled mutes on the same signal path, which is what the
 * scheduled-mute contract needs. The input gain sets the element's own
 * level ahead of it; any other sound connected to {@link output} is
 * heard at the same volume and muted with it.
 *
 * The underlying `AudioContext` starts suspended under the browser
 * autoplay policy. Callers resume it from a user gesture with
 * {@link resumeIfSuspended} before audio is expected to flow.
 */
export class MediaElementAudioGraph {

  private readonly audioContext: AudioContext;
  private readonly inputGainNode: GainNode;
  private readonly gainNode: GainNode;
  private currentLevel = 1;

  constructor(mediaElement: HTMLMediaElement) {
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaElementSource(mediaElement);
    this.inputGainNode = this.audioContext.createGain();
    this.gainNode = this.audioContext.createGain();
    source.connect(this.inputGainNode);
    this.inputGainNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.value = this.currentLevel;
  }

  get context(): AudioContext {
    return this.audioContext;
  }

  /** Where other sound joins the element's: at the output level, under its scheduled mutes. */
  get output(): AudioNode {
    return this.gainNode;
  }

  /** The element's own level, linear, applied before the output level; 0 silences it. Its owner may schedule it. */
  get inputLevel(): AudioParam {
    return this.inputGainNode.gain;
  }

  /** Resume the underlying AudioContext if the autoplay policy left
   *  it suspended. Safe to call repeatedly. */
  async resumeIfSuspended(): Promise<void> {
    if (this.audioContext.state !== 'suspended') return;
    await this.audioContext.resume();
  }

  /** Set the steady-state output level. Overwrites any pending
   *  scheduled mute so a fresh volume change is heard immediately. */
  setLevel(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.currentLevel = clamped;
    const gain = this.gainNode.gain;
    const now = this.audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(clamped, now);
  }

  /**
   * Schedule the output to drop to silence after `wallClockSec`
   * real-time seconds from now, applied on the audio rendering
   * thread at the next sample boundary. Any pending schedule is
   * replaced; the gain sits at the current level until the drop.
   */
  scheduleMuteIn(wallClockSec: number): void {
    const gain = this.gainNode.gain;
    const now = this.audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(this.currentLevel, now);
    gain.setValueAtTime(0, now + Math.max(0, wallClockSec));
  }

  /** Cancel any pending scheduled mute and restore the output to
   *  the current steady-state level. */
  cancelScheduledMute(): void {
    const gain = this.gainNode.gain;
    const now = this.audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(this.currentLevel, now);
  }

  /** Tear the graph down. The routing is released for the media
   *  element once the AudioContext closes. */
  async dispose(): Promise<void> {
    this.inputGainNode.disconnect();
    this.gainNode.disconnect();
    try {
      await this.audioContext.close();
    } catch {
      // Closing an already-closed context throws; dispose is idempotent.
    }
  }
}
