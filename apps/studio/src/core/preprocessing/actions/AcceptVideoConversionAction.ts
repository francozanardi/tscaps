import type { VideoConversionOfferCoordinator } from '@core/preprocessing/services/VideoConversionOfferCoordinator';

/** Starts the conversion the reader was offered. No-op when no offer is waiting. */
export class AcceptVideoConversionAction {

  constructor(private readonly coordinator: VideoConversionOfferCoordinator) {}

  execute(): void {
    this.coordinator.answer(true);
  }
}
