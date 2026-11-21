import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { PersonFollow } from '@core/subject-tracking/domain/PersonFollow';
import type { PersonPick } from '@core/subject-tracking/domain/PersonPick';
import type { PersonSightingReader } from '@core/subject-tracking/domain/PersonSightingReader';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';
import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';
import type { PersonFollowPlanner } from '@core/subject-tracking/services/PersonFollowPlanner';

/** What to follow: who, through which stretch, with a crop of what size, and the framing to keep if the person stays in it. */
export interface PlanPersonFollowInput {
  readonly stretch: SourceStretch;
  readonly pick: PersonPick;
  readonly crop: CropSize;
  readonly held: PicturePosition | null;
  readonly signal: AbortSignal;
  /** How far the planning is, from 0 to 1. */
  readonly onProgress: (fraction: number) => void;
}

// A frame a second tells whether the person stays inside one framing; four a second give the path when they do not.
const SPARSE_FRAMES_PER_SECOND = 1;
const DENSE_FRAMES_PER_SECOND = 4;
const SPARSE_SHARE_OF_WORK = SPARSE_FRAMES_PER_SECOND / (SPARSE_FRAMES_PER_SECOND + DENSE_FRAMES_PER_SECOND);

/**
 * Plans how a crop follows a person through a stretch of the open
 * video, read from the preview proxy where there is one, else from the
 * original. It looks first at a frame a second, which is enough when
 * the person stays inside one framing; only where they do not does it
 * read the stretch again at four frames a second to plan the path.
 */
export class PlanPersonFollowAction {
  constructor(
    private readonly store: EditorStore,
    private readonly reader: PersonSightingReader,
    private readonly planner: PersonFollowPlanner,
  ) {}

  /**
   * The person followed and the plan, or null where no video is loaded
   * or nobody is at the pick. Rejects with an `AbortError` once the signal fires, and with
   * the cause where the video cannot be read or the detector cannot run.
   */
  async execute(input: PlanPersonFollowInput): Promise<PersonFollow | null> {
    const video = this.videoToRead();
    if (video === null) return null;
    const sparse = await this.framesOf(video, input, SPARSE_FRAMES_PER_SECOND, (fraction) => input.onProgress(fraction * SPARSE_SHARE_OF_WORK));
    const first = this.planOf(sparse, input);
    if (first === null || first.plan.kind !== 'moving') {
      input.onProgress(1);
      return first;
    }
    const dense = await this.framesOf(video, input, DENSE_FRAMES_PER_SECOND, (fraction) => input.onProgress(SPARSE_SHARE_OF_WORK + fraction * (1 - SPARSE_SHARE_OF_WORK)));
    return this.planOf(dense, input);
  }

  private videoToRead(): Blob | null {
    const video = this.store.snapshot().video;
    return video.preview?.file ?? video.file;
  }

  private framesOf(video: Blob, input: PlanPersonFollowInput, framesPerSecond: number, onProgress: (fraction: number) => void): Promise<SightedFrame[]> {
    return this.reader.read(video, [{ ...input.stretch, framesPerSecond }], input.signal, onProgress);
  }

  private planOf(frames: ReadonlyArray<SightedFrame>, input: PlanPersonFollowInput): PersonFollow | null {
    return this.planner.plan(frames, input.pick, input.crop, input.stretch, input.held);
  }
}
