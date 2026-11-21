import type { SoundAuditionOutput, SoundAuditionVoice } from '@core/audio-mix/domain/SoundAuditionOutput';
import { MediaElementSoundAuditionVoice } from '@core/audio-mix/infrastructure/MediaElementSoundAuditionVoice';

/**
 * {@link SoundAuditionOutput} on an audio context of its own, apart from
 * the preview's. The context is made on the first sound asked for, which
 * a press of a button always is, so the browser lets it run; it is kept
 * for the page's life and shared by every voice.
 */
export class WebAudioSoundAuditionOutput implements SoundAuditionOutput {
  private context: AudioContext | null = null;

  play(file: string | Blob, startSec: number, gain: number, onEnded: () => void): SoundAuditionVoice {
    this.context ??= new AudioContext();
    const voice = new MediaElementSoundAuditionVoice(this.context, file, startSec, gain, onEnded);
    voice.start();
    return voice;
  }
}
