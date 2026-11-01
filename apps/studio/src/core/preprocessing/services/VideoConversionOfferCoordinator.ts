import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type { VideoConversionOfferStore } from '@core/preprocessing/store/VideoConversionOfferStore';

/**
 * Puts a conversion offer to the reader and holds the run until they
 * answer: publishes the offer through the {@link VideoConversionOfferStore}
 * so the UI can ask, and settles the waiting promise once
 * {@link answer} is called.
 */
export class VideoConversionOfferCoordinator {

  private resolver: ((accepted: boolean) => void) | null = null;

  constructor(private readonly offerStore: VideoConversionOfferStore) {}

  /**
   * Resolves to `true` when the reader accepts, `false` when they
   * decline. One offer waits at a time: a second call settles the
   * first as declined, so its caller does not wait forever.
   */
  offerAndAwait(offer: VideoConversionOffer): Promise<boolean> {
    this.answer(false);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.offerStore.set(offer);
    });
  }

  /** No-op when no offer is waiting. */
  answer(accepted: boolean): void {
    const resolver = this.resolver;
    if (!resolver) return;
    this.resolver = null;
    this.offerStore.set(null);
    resolver(accepted);
  }
}
