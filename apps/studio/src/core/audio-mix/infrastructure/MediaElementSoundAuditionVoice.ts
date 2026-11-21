import type { SoundAuditionVoice } from '@core/audio-mix/domain/SoundAuditionOutput';

/**
 * A {@link SoundAuditionVoice} played by an `<audio>` element routed
 * through a gain node, so its level can go past the element's own
 * ceiling of 1 and follow a slider while it plays. A file handed over
 * as itself gets an address of its own, given back when it stops.
 */
export class MediaElementSoundAuditionVoice implements SoundAuditionVoice {
  private readonly element: HTMLAudioElement;
  private readonly objectUrl: string | null;
  private readonly gainNode: GainNode;
  private readonly sourceNode: MediaElementAudioSourceNode;
  private stopped = false;

  constructor(
    private readonly context: AudioContext,
    file: string | Blob,
    startSec: number,
    gain: number,
    private readonly onEnded: () => void,
  ) {
    this.objectUrl = typeof file === 'string' ? null : URL.createObjectURL(file);
    this.element = new Audio(this.objectUrl ?? (file as string));
    // Read before the file is: the element starts from here once it can.
    this.element.currentTime = Math.max(0, startSec);
    this.sourceNode = context.createMediaElementSource(this.element);
    this.gainNode = context.createGain();
    this.gainNode.gain.value = gain;
    this.sourceNode.connect(this.gainNode).connect(context.destination);
    this.element.addEventListener('ended', this.end);
    this.element.addEventListener('error', this.end);
  }

  /** Starts it; a browser that refuses to play ends it as a file that cannot be played would. */
  start(): void {
    void this.context.resume().catch(this.end);
    this.element.play().catch(this.end);
  }

  setGain(gain: number): void {
    if (this.stopped) return;
    this.gainNode.gain.setValueAtTime(gain, this.context.currentTime);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.element.removeEventListener('ended', this.end);
    this.element.removeEventListener('error', this.end);
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.sourceNode.disconnect();
    this.gainNode.disconnect();
    if (this.objectUrl !== null) URL.revokeObjectURL(this.objectUrl);
  }

  private readonly end = (): void => {
    if (this.stopped) return;
    this.stop();
    this.onEnded();
  };
}
