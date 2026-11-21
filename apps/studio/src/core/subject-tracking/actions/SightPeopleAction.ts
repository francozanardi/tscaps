import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSightingReader } from '@core/subject-tracking/domain/PersonSightingReader';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';

/**
 * Finds everyone seen through stretches of the open video, frame by
 * frame at each stretch's rate, read from the preview proxy where there
 * is one, else from the original.
 */
export class SightPeopleAction {
  constructor(
    private readonly store: EditorStore,
    private readonly reader: PersonSightingReader,
  ) {}

  /**
   * The frames of `stretches` (seconds of the source video), in time
   * order, each with the people seen in it; empty where no video is
   * loaded. `onProgress` is told how far the reading is, from 0 to 1.
   * Rejects with an `AbortError` once `signal` fires, and with the cause
   * where the video cannot be read or the detector cannot run.
   */
  async execute(stretches: ReadonlyArray<SamplingStretch>, signal: AbortSignal, onProgress: (fraction: number) => void): Promise<SightedFrame[]> {
    const { video } = this.store.snapshot();
    const source = video.preview?.file ?? video.file;
    if (source === null || stretches.length === 0) return [];
    return this.reader.read(source, stretches, signal, onProgress);
  }
}
