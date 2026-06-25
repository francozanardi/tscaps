/**
 * Routes the audio of an `HTMLMediaElement` through a Web Audio
 * graph so consumers can schedule sample-accurate cuts on the
 * audio rendering clock. The chain is:
 *
 *   media element → MediaElementAudioSourceNode → GainNode → destination
 *
 * The `<video>` element's own `volume` property still scales the
 * source level in all major browsers, so volume control stays on
 * the element; the gain node here is dedicated to scheduled cuts
 * (`scheduleMuteIn` / `cancelScheduledMute`).
 *
 * Routing through Web Audio is sticky: once attached to a media
 * element, the element's audio stays inside the graph for the
 * AudioContext's lifetime. `dispose()` closes the context, which
 * releases the routing so the element can later be re-attached
 * to a new graph if needed.
 *
 * The AudioContext starts suspended in browsers that enforce the
 * autoplay gesture policy. Call `resume()` from a user gesture
 * (e.g. a play click) before audio is expected to flow.
 */
export class AudioGraph {

  private readonly audioContext: AudioContext;
  private readonly sourceNode: MediaElementAudioSourceNode;
  private readonly gainNode: GainNode;

  constructor(mediaElement: HTMLMediaElement) {
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaElementSource(mediaElement);
    this.gainNode = this.audioContext.createGain();
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  /** Resume the underlying AudioContext if the autoplay policy
   *  left it suspended. Safe to call repeatedly. */
  async resume(): Promise<void> {
    if (this.audioContext.state !== 'suspended') return;
    await this.audioContext.resume();
  }

  /**
   * Schedule the output to drop to silence after `wallClockSec`
   * seconds, applied by the audio rendering thread at the next
   * audio frame boundary. Any pending schedule is replaced; the
   * gain is anchored at unity until the drop, so calling this
   * after a previous cut already fired still produces normal
   * audio until the new deadline.
   */
  scheduleMuteIn(wallClockSec: number): void {
    const gain = this.gainNode.gain;
    const now = this.audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(1, now);
    gain.setValueAtTime(0, now + Math.max(0, wallClockSec));
  }

  /** Cancel any pending scheduled cut and restore the gain to
   *  unity immediately. */
  cancelScheduledMute(): void {
    const gain = this.gainNode.gain;
    const now = this.audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(1, now);
  }

  /** Tear down the audio graph and close the AudioContext. */
  async dispose(): Promise<void> {
    this.gainNode.disconnect();
    this.sourceNode.disconnect();
    try {
      await this.audioContext.close();
    } catch {
      // Closing an already-closed context throws; the dispose is idempotent.
    }
  }
}
