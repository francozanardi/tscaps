import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import { WAVEFORM_PEAKS_PER_SECOND } from '@core/audio/domain/WaveformResolution';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { AudioLevels } from '@core/editor-operations/services/AudioLevels';

/**
 * Reads how loud the project's source video is over time, from the same
 * peak envelope the timeline draws (worked out once per file and kept).
 * The first read of a file decodes its whole audio, which takes a moment
 * on a long video.
 */
export class AudioLevelsReader {
  constructor(
    private readonly store: EditorStore,
    private readonly waveforms: WaveformExtractor,
  ) {}

  /** The audio's levels, or null when the video's file is not loaded yet or has no sound. */
  async read(): Promise<AudioLevels | null> {
    const file = this.store.snapshot().video.file;
    if (file === null) return null;
    const peaks = await this.waveforms.extract(file, WAVEFORM_PEAKS_PER_SECOND);
    return peaks.length === 0 ? null : new AudioLevels(peaks, WAVEFORM_PEAKS_PER_SECOND);
  }
}
