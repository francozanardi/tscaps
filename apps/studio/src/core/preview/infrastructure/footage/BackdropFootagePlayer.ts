import { BackdropFootage, type FootagePass } from '@tscaps/engine/advanced';
import type { FootagePlayer, HeldFootagePicture } from '@core/preview/infrastructure/footage/FootagePlayer';

/**
 * {@link FootagePlayer} for a backdrop layer: there is nothing to open
 * or play, since the compositor draws the frame beneath the layer in
 * its place, so it holds a picture from the moment it opens.
 */
export class BackdropFootagePlayer implements FootagePlayer {
  private readonly backdrop = new BackdropFootage();
  private streaming = false;
  private disposed = false;

  constructor(
    readonly pass: FootagePass,
    private readonly onPainted: (pass: FootagePass) => void,
  ) {}

  /** Reports the picture painted once the player is in place, never from inside the call that opens it. */
  open(): void {
    queueMicrotask(() => {
      if (!this.disposed) this.onPainted(this.pass);
    });
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  stream(): void {
    this.streaming = true;
  }

  still(): void {
    this.streaming = false;
  }

  scrub(): void {
    this.streaming = false;
  }

  idle(): void {
    this.streaming = false;
  }

  dispose(): void {
    this.disposed = true;
  }

  picture(): HeldFootagePicture {
    return { picture: this.backdrop, width: this.backdrop.width, height: this.backdrop.height };
  }
}
