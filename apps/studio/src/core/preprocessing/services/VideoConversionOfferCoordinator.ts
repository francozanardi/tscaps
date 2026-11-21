import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type { VideoConversionOfferStore } from '@core/preprocessing/store/VideoConversionOfferStore';

/**
 * How an offer to convert a video was settled. `withdrawn` means it was
 * taken back before the reader answered.
 */
export type VideoConversionAnswer = 'accepted' | 'declined' | 'withdrawn';

/**
 * Puts a conversion offer to the reader and holds the run until they
 * answer: publishes the offer through the {@link VideoConversionOfferStore}
 * so the UI can ask, and settles the waiting promise once
 * {@link answer} is called, or once the offer is taken back with
 * {@link withdraw}.
 */
export class VideoConversionOfferCoordinator {

  private waiting: {
    readonly offer: VideoConversionOffer;
    readonly settle: (answer: VideoConversionAnswer) => void;
  } | null = null;

  constructor(private readonly offerStore: VideoConversionOfferStore) {}

  /**
   * Resolves to the reader's answer, or to `withdrawn`. One offer waits
   * at a time: a second call settles the first as declined, so its
   * caller does not wait forever.
   */
  offerAndAwait(offer: VideoConversionOffer): Promise<VideoConversionAnswer> {
    this.answer(false);
    return new Promise<VideoConversionAnswer>((resolve) => {
      this.waiting = { offer, settle: resolve };
      this.offerStore.set(offer);
    });
  }

  /** No-op when no offer is waiting. */
  answer(accepted: boolean): void {
    this.settle(accepted ? 'accepted' : 'declined');
  }

  /**
   * Takes `offer` back from the reader and settles it as withdrawn, as
   * when nobody is left to answer it. No-op unless `offer` is the one
   * waiting.
   */
  withdraw(offer: VideoConversionOffer): void {
    if (this.waiting?.offer !== offer) return;
    this.settle('withdrawn');
  }

  private settle(answer: VideoConversionAnswer): void {
    const waiting = this.waiting;
    if (!waiting) return;
    this.waiting = null;
    this.offerStore.set(null);
    waiting.settle(answer);
  }
}
