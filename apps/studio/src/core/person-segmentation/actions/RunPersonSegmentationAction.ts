import type { PersonSegmenter } from '@core/person-segmentation/domain/PersonSegmenter';
import type { PersonSegmentationOptions } from '@core/person-segmentation/domain/PersonSegmentationOptions';
import { DEFAULT_PERSON_SEGMENTATION_OPTIONS } from '@core/person-segmentation/domain/PersonSegmentationOptions';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationRunController } from '@core/person-segmentation/services/PersonSegmentationRunController';
import type { PersonSegmentationProgressStore } from '@core/person-segmentation/store/PersonSegmentationProgressStore';

export interface RunPersonSegmentationInput {
  readonly video: HTMLVideoElement;
  readonly options?: Partial<PersonSegmentationOptions>;
}

/**
 * Kicks off a person-segmentation run for a loaded video. The action
 * takes exclusive control of the run through the controller, publishes
 * progress into the store, and returns the aggregate detector output.
 * Cancellation happens through the sibling cancel action, which
 * signals the controller's abort — the returned promise then rejects
 * with an `AbortError`.
 */
export class RunPersonSegmentationAction {

  constructor(
    private readonly segmenter: PersonSegmenter,
    private readonly runController: PersonSegmentationRunController,
    private readonly progressStore: PersonSegmentationProgressStore,
  ) {}

  async execute(input: RunPersonSegmentationInput): Promise<PersonSegmentationResult> {
    const signal = this.runController.begin();
    this.progressStore.start();
    try {
      const options = this.resolveOptions(input.options);
      return await this.segmenter.run(input.video, options, signal, (progress) => this.progressStore.updateProgress(progress));
    } finally {
      this.progressStore.finish();
      this.runController.finish();
    }
  }

  private resolveOptions(overrides?: Partial<PersonSegmentationOptions>): PersonSegmentationOptions {
    if (overrides === undefined) return DEFAULT_PERSON_SEGMENTATION_OPTIONS;
    return { ...DEFAULT_PERSON_SEGMENTATION_OPTIONS, ...overrides };
  }
}
