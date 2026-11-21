import { AnimatedImageOpenFailedError } from '@modules/video/animation/AnimatedImageOpenFailedError';
import type { AnimatedImageOpener } from '@modules/video/animation/AnimatedImageOpener';
import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';

/**
 * {@link AnimatedImageOpener} that asks each of `openers` in turn and
 * answers the first footage one of them opens, so a preferred way of
 * decoding (the browser's own, say) stands in front of one that works
 * everywhere. An opener that refuses — the browser lacks what it needs,
 * or it cannot read this file — passes the file to the next.
 *
 * Rejects with an {@link AnimatedImageOpenFailedError} when none of
 * them can open it; its `cause` is an `AggregateError` of each one's
 * refusal, in order.
 */
export class FallbackAnimatedImageOpener implements AnimatedImageOpener {
  constructor(private readonly openers: ReadonlyArray<AnimatedImageOpener>) {}

  async open(blob: Blob): Promise<DrawableFootage> {
    const refusals: unknown[] = [];
    for (const opener of this.openers) {
      try {
        return await opener.open(blob);
      } catch (error) {
        refusals.push(error);
      }
    }
    throw new AnimatedImageOpenFailedError('No decoder could open the animated image.', {
      cause: new AggregateError(refusals, 'Every decoder refused the animated image.'),
    });
  }
}
