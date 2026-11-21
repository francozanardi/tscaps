/** The features of one window: `[1, bands, frames]`, each band's frames in a row. */
export interface WindowFeatures {
  readonly input_features: {
    readonly dims: number[];
    readonly data: Float32Array;
  };
}

/** The part of a loaded Whisper feature extractor this class reaches into. */
export interface WindowFeatureExtractor {
  /** `hop_length` is how many audio samples one frame advances by. */
  readonly config: { readonly hop_length: number };
  _call(audio: Float32Array, ...options: unknown[]): Promise<WindowFeatures>;
}

/**
 * What a frame holds where the window has no audio: zero in the model's
 * feature scale, which is where the reference decoder leaves it.
 */
const NO_AUDIO_FEATURE = 0;

/**
 * Fills the part of a window that has no audio the way the reference
 * Whisper decoder does.
 *
 * The model always reads a window of one fixed length. Audio shorter than
 * that leaves a tail to fill, and there are two ways to fill it: append
 * zero samples to the audio and extract features from all of it, so the
 * tail reads as digital silence, or extract features from the audio alone
 * and leave the tail's frames at zero. The extraction this wraps does the
 * first; the reference decoder does the second, and the model's timestamps
 * depend on which one it is given.
 *
 * Over a tail of digital silence a model can open its first segment late
 * and then close it seconds past where the speech it has written ends. The
 * next segment starts after that close, so the speech in between is never
 * written, with nothing in the output to show for it. Measured on a 15 s
 * recording, the same model dropped 11 of its 31 words with the first
 * filling and none with the second.
 *
 * Only the frames past the end of the audio change. A window the audio
 * fills is left exactly as it was.
 */
export class WhisperShortWindowPadder {

  private readonly installed = new WeakSet<WindowFeatureExtractor>();

  /** Replaces the extractor's extraction in place. Installing twice on the same extractor is a no-op. */
  install(extractor: WindowFeatureExtractor): void {
    if (this.installed.has(extractor)) return;
    this.installed.add(extractor);
    const original = extractor._call.bind(extractor);
    extractor._call = async (audio, ...options) => {
      const features = await original(audio, ...options);
      this.clearPastAudio(features, Math.floor(audio.length / extractor.config.hop_length));
      return features;
    };
  }

  private clearPastAudio(features: WindowFeatures, audioFrames: number): void {
    const { dims, data } = features.input_features;
    const frames = dims[dims.length - 1] ?? 0;
    if (frames === 0 || audioFrames >= frames) return;
    for (let bandStart = 0; bandStart < data.length; bandStart += frames) {
      data.fill(NO_AUDIO_FEATURE, bandStart + audioFrames, bandStart + frames);
    }
  }
}
