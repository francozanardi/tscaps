import { describe, expect, it } from 'vitest';
import { AnimatedImageOpenFailedError } from '@modules/video/animation/AnimatedImageOpenFailedError';
import type { AnimatedImageOpener } from '@modules/video/animation/AnimatedImageOpener';
import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';
import { FallbackAnimatedImageOpener } from '@modules/video/animation/FallbackAnimatedImageOpener';

/**
 * An animated image is opened by the first way that can open it, the
 * preferred one first; a file none can open is refused by name, with
 * every refusal kept, rather than shown as a still.
 */

/** Footage that names the opener it came from, by its width. */
function footageNamed(width: number): DrawableFootage {
  return {
    width,
    height: 1,
    pictureAt: async () => null,
    draw: () => undefined,
    close: async () => undefined,
  };
}

class OpeningOpener implements AnimatedImageOpener {
  constructor(private readonly name: number) {}

  async open(): Promise<DrawableFootage> {
    return footageNamed(this.name);
  }
}

class RefusingOpener implements AnimatedImageOpener {
  constructor(private readonly reason: string) {}

  async open(): Promise<DrawableFootage> {
    throw new AnimatedImageOpenFailedError(this.reason);
  }
}

const gif = new Blob([new Uint8Array([0x47, 0x49, 0x46])], { type: 'image/gif' });

describe('opening an animated image by the first way that can', () => {
  it('opens it the preferred way where that way can', async () => {
    const opener = new FallbackAnimatedImageOpener([new OpeningOpener(1), new OpeningOpener(2)]);

    expect((await opener.open(gif)).width).toBe(1);
  });

  it('opens it the next way where the preferred one refuses', async () => {
    const opener = new FallbackAnimatedImageOpener([new RefusingOpener('no decoder here'), new OpeningOpener(2)]);

    expect((await opener.open(gif)).width).toBe(2);
  });

  it('refuses by name where no way can, keeping each refusal in order', async () => {
    const opener = new FallbackAnimatedImageOpener([new RefusingOpener('no decoder here'), new RefusingOpener('not a GIF')]);

    const refusal = await opener.open(gif).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(AnimatedImageOpenFailedError);
    expect((refusal as Error).name).toBe('AnimatedImageOpenFailedError');
    const cause = (refusal as Error).cause as AggregateError;
    expect(cause.errors.map((error: Error) => error.message)).toEqual(['no decoder here', 'not a GIF']);
  });
});
