import type { AudioMixLayer } from '@core/audio-mix/domain/AudioMixLayer';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/** What the preview mixes, as last built. */
export interface AudioMixPreview {
  /** The layers the preview plays: the clips heard, whose files it holds. */
  readonly layers: ReadonlyArray<AudioMixLayer>;
  /** The files some heard clip plays that could not be had, each once: those clips stay silent. */
  readonly unavailable: ReadonlyArray<AudioSourceRef>;
  /** The files some heard clip plays that are still being read: those clips join once they land. */
  readonly reading: ReadonlyArray<AudioSourceRef>;
}

/**
 * The soundtrack the preview plays, as last built; null while none is.
 * Emits `'change'` on every write. Holds no logic of its own.
 */
export class AudioMixPreviewStore extends EventTarget {
  private preview: AudioMixPreview | null = null;

  snapshot(): AudioMixPreview | null {
    return this.preview;
  }

  set(preview: AudioMixPreview | null): void {
    if (preview === this.preview) return;
    this.preview = preview;
    this.dispatchEvent(new Event('change'));
  }
}
