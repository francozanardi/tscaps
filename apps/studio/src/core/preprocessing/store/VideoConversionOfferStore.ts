import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';

/**
 * Holds the conversion offer waiting on the reader's answer, or `null`
 * when none is. Subscribers listen for `'change'` and read `offer`.
 */
export class VideoConversionOfferStore extends EventTarget {

  private _offer: VideoConversionOffer | null = null;

  get offer(): VideoConversionOffer | null {
    return this._offer;
  }

  set(offer: VideoConversionOffer | null): void {
    if (offer === this._offer) return;
    this._offer = offer;
    this.dispatchEvent(new Event('change'));
  }
}
