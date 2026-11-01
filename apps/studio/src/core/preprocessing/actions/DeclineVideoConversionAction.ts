import type { VideoConversionOfferCoordinator } from '@core/preprocessing/services/VideoConversionOfferCoordinator';

/**
 * Turns down the conversion the reader was offered: the run ends with
 * the refusal that prompted the offer. No-op when no offer is waiting.
 */
export class DeclineVideoConversionAction {

  constructor(private readonly coordinator: VideoConversionOfferCoordinator) {}

  execute(): void {
    this.coordinator.answer(false);
  }
}
