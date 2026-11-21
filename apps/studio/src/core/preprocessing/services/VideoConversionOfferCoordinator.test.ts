import { describe, expect, it } from 'vitest';
import { VideoConversionOfferCoordinator } from '@core/preprocessing/services/VideoConversionOfferCoordinator';
import { VideoConversionOfferStore } from '@core/preprocessing/store/VideoConversionOfferStore';

/**
 * An offer can be taken back when nobody is left to answer it. Taking
 * one back must never settle a different offer that is waiting by then.
 */

describe('VideoConversionOfferCoordinator', () => {
  it('settles a withdrawn offer as withdrawn and stops showing it', async () => {
    const store = new VideoConversionOfferStore();
    const coordinator = new VideoConversionOfferCoordinator(store);
    const offer = { estimatedSeconds: 95, memoryHeavy: false };

    const answering = coordinator.offerAndAwait(offer);
    coordinator.withdraw(offer);

    expect(await answering).toBe('withdrawn');
    expect(store.offer).toBeNull();
  });

  it('leaves the offer waiting when one that was already settled is withdrawn', async () => {
    const store = new VideoConversionOfferStore();
    const coordinator = new VideoConversionOfferCoordinator(store);
    const earlier = { estimatedSeconds: 95, memoryHeavy: false };
    const later = { estimatedSeconds: 40, memoryHeavy: false };

    const earlierAnswer = coordinator.offerAndAwait(earlier);
    coordinator.answer(true);
    const laterAnswer = coordinator.offerAndAwait(later);
    coordinator.withdraw(earlier);
    coordinator.answer(false);

    expect(await earlierAnswer).toBe('accepted');
    expect(await laterAnswer).toBe('declined');
  });
});
