import type { AnimatedImageOpener } from '@tscaps/engine/advanced';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';

/**
 * {@link GifPlaybackProbe} that opens the GIF with the engine opener
 * GIFs are played through, which decodes its first frame, and closes it
 * again. Rejects with the opener's refusal.
 */
export class AnimatedImageOpenerGifPlaybackProbe implements GifPlaybackProbe {
  constructor(private readonly opener: AnimatedImageOpener) {}

  async ensurePlayable(gif: Blob): Promise<void> {
    const footage = await this.opener.open(gif);
    await footage.close();
  }
}
