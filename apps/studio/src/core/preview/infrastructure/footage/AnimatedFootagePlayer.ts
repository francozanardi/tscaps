import type { AnimatedImageOpener, DrawableFootage, FootageLayerSchedule, FootagePass } from '@tscaps/engine/advanced';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';
import type { FootagePlayer, HeldFootagePicture } from '@core/preview/infrastructure/footage/FootagePlayer';

/**
 * {@link FootagePlayer} for an animated image: opened once, and asked
 * for the frame of the moment the playhead is at — every animation frame
 * while streaming, once on a still or a scrub. Which frame that is comes
 * from the same engine footage the export reads, so both show the same
 * frame for the same moment.
 *
 * The picture it holds is the footage itself, which draws the frame
 * decoded last, so it can be drawn on every composition while the next
 * frame decodes. Disposing it closes the footage.
 */
export class AnimatedFootagePlayer implements FootagePlayer {
  private footage: DrawableFootage | null = null;
  private hasPicture = false;
  private streaming = false;
  private pendingOutputSec: number | null = null;
  private frameRequestId = 0;
  private disposed = false;

  constructor(
    readonly pass: FootagePass,
    private readonly blob: Blob,
    private readonly opener: AnimatedImageOpener,
    private readonly schedule: FootageLayerSchedule,
    private readonly time: PlaybackTimeSource,
    private readonly onPainted: (pass: FootagePass) => void,
  ) {}

  open(): void {
    void this.openFootage();
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  stream(): void {
    this.streaming = true;
    this.requestFrames();
  }

  still(atOutputSec: number): void {
    this.stopStreaming();
    this.show(atOutputSec);
  }

  scrub(atOutputSec: number): void {
    this.stopStreaming();
    this.show(atOutputSec);
  }

  idle(): void {
    this.stopStreaming();
  }

  dispose(): void {
    this.disposed = true;
    this.stopStreaming();
    void this.footage?.close();
    this.footage = null;
    this.hasPicture = false;
  }

  picture(): HeldFootagePicture | null {
    const footage = this.footage;
    return footage && this.hasPicture ? { picture: footage, width: footage.width, height: footage.height } : null;
  }

  private async openFootage(): Promise<void> {
    try {
      const footage = await this.opener.open(this.blob);
      if (this.disposed) {
        void footage.close();
        return;
      }
      this.footage = footage;
      if (this.streaming) this.show(this.time.currentOutputTimeSec());
      else if (this.pendingOutputSec !== null) this.show(this.pendingOutputSec);
    } catch (error) {
      if (!this.disposed) console.error('[preview] a footage animation could not be opened', error);
    }
  }

  /** Asks for the frame at `outputSec`, held for when the footage opens if it has not yet. */
  private show(outputSec: number): void {
    const footage = this.footage;
    if (!footage) {
      this.pendingOutputSec = outputSec;
      return;
    }
    const passSec = Math.min(Math.max(outputSec, this.pass.outputStartSec), this.pass.outputEndSec);
    void footage.pictureAt(this.schedule.sourceTimeAt(this.pass.layer, passSec)).then((picture) => {
      if (this.disposed || picture === null) return;
      // While streaming, the layer composes every animation frame anyway;
      // only the first picture is news to it.
      const isNews = !this.hasPicture || !this.streaming;
      this.hasPicture = true;
      if (isNews) this.onPainted(this.pass);
    });
  }

  private requestFrames(): void {
    if (this.frameRequestId !== 0) return;
    const tick = (): void => {
      this.frameRequestId = 0;
      if (!this.streaming || this.disposed) return;
      this.show(this.time.currentOutputTimeSec());
      this.frameRequestId = requestAnimationFrame(tick);
    };
    this.frameRequestId = requestAnimationFrame(tick);
  }

  private stopStreaming(): void {
    this.streaming = false;
    cancelAnimationFrame(this.frameRequestId);
    this.frameRequestId = 0;
  }
}
