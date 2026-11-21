import { type FootagePictureProvider } from '@tscaps/engine';
import { ProvidedFootage, type FootageLayerSchedule, type FootagePass } from '@tscaps/engine/advanced';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';
import type { FootagePlayer, HeldFootagePicture } from '@core/preview/infrastructure/footage/FootagePlayer';

// How long a new player waits before opening its pictures. A drag on the box replaces the player at every step, and
// each opening starts the pictures afresh; one replaced within the wait never opens. What it replaced shows meanwhile.
const OPEN_DELAY_MS = 150;

/**
 * {@link FootagePlayer} for pictures a provider draws: opened once, a
 * moment after it is asked to (one let go before then never opens), and
 * asked for the picture of the moment the playhead is at — every
 * animation frame while streaming, once on a still or a scrub. Which
 * moment that is comes from the same schedule the export reads, so both
 * show the same picture for the same moment.
 *
 * One moment is asked at a time: while one is being drawn, only the
 * latest moment wanted waits, and the ones in between are skipped. The
 * picture held is the last one drawn, so it can be drawn on every
 * composition while the next is on its way. Disposing it closes the
 * pictures.
 *
 * The pictures are asked at `pictureScale` of their full size: what
 * the preview draws them at, where that is smaller.
 */
export class ProvidedFootagePlayer implements FootagePlayer {
  private footage: ProvidedFootage | null = null;
  private hasPicture = false;
  private streaming = false;
  private drawing = false;
  private wantedOutputSec: number | null = null;
  private frameRequestId = 0;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    readonly pass: FootagePass,
    private readonly provider: FootagePictureProvider,
    private readonly schedule: FootageLayerSchedule,
    private readonly time: PlaybackTimeSource,
    private readonly onPainted: (pass: FootagePass) => void,
    private readonly pictureScale: number,
  ) {}

  open(): void {
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      void this.openFootage();
    }, OPEN_DELAY_MS);
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
    if (this.openTimer !== null) clearTimeout(this.openTimer);
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
      const pictures = await this.provider.open(this.pictureScale);
      if (this.disposed) {
        pictures.close();
        return;
      }
      this.footage = new ProvidedFootage(pictures);
      if (this.streaming) this.show(this.time.currentOutputTimeSec());
      else if (this.wantedOutputSec !== null) this.drawWanted();
    } catch (error) {
      if (!this.disposed) console.error('[preview] provided footage could not be opened', error);
    }
  }

  /** Asks for the picture at `outputSec` once the one being drawn lands, or once the footage opens. */
  private show(outputSec: number): void {
    this.wantedOutputSec = outputSec;
    if (this.footage !== null && !this.drawing) this.drawWanted();
  }

  private drawWanted(): void {
    const footage = this.footage;
    const outputSec = this.wantedOutputSec;
    if (footage === null || outputSec === null) return;
    this.wantedOutputSec = null;
    this.drawing = true;
    const passSec = Math.min(Math.max(outputSec, this.pass.outputStartSec), this.pass.outputEndSec);
    footage.pictureAt(this.schedule.sourceTimeAt(this.pass.layer, passSec)).then((picture) => {
      if (this.disposed || picture === null) return;
      // While streaming, the layer composes every animation frame anyway; only the first picture is news to it.
      const isNews = !this.hasPicture || !this.streaming;
      this.hasPicture = true;
      if (isNews) this.onPainted(this.pass);
    }, (error: unknown) => {
      if (!this.disposed) console.error('[preview] a provided picture could not be drawn', error);
    }).finally(() => {
      this.drawing = false;
      if (!this.disposed && this.wantedOutputSec !== null) this.drawWanted();
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
