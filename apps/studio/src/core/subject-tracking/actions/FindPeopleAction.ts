import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { PersonSightingReader } from '@core/subject-tracking/domain/PersonSightingReader';

// Each moment is read as a stretch this long at one frame a second, which gives the frame shown there and no other.
const MOMENT_SEC = 0.01;

/**
 * Finds who is in the open video at a few moments, read from the preview
 * proxy where there is one, else from the original, and answers the
 * first of them, in the order given, in which anyone is seen, with the
 * people in the order they stand, from left to right.
 */
export class FindPeopleAction {
  constructor(
    private readonly store: EditorStore,
    private readonly reader: PersonSightingReader,
  ) {}

  /**
   * The people at the first of `moments` (seconds of the source video)
   * in which someone is seen; null where nobody is seen at any of them
   * or no video is loaded. Rejects with an `AbortError` once `signal`
   * fires, and with the cause where the video cannot be read or the
   * detector cannot run.
   */
  async execute(moments: ReadonlyArray<number>, signal: AbortSignal): Promise<PeopleAtMoment | null> {
    const { video } = this.store.snapshot();
    const source = video.preview?.file ?? video.file;
    if (source === null || moments.length === 0) return null;
    const stretches = moments.map((sec) => ({ startSec: sec, endSec: sec + MOMENT_SEC, framesPerSecond: 1 }));
    const frames = await this.reader.read(source, stretches, signal, () => undefined);
    const found = frames.find((frame) => frame.people.length > 0);
    if (found === undefined) return null;
    return { sourceSec: found.sourceSec, people: [...found.people].sort((first, second) => first.box.minX - second.box.minX) };
  }
}
