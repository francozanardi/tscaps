import { RenderTimeMap } from '@tscaps/engine';
import { type FootagePass } from '@tscaps/engine/advanced';
import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';
import type { PreviewSourceLoader } from '@core/preview/domain/PreviewSourceLoader';
import type { VideoFramePump } from '@core/preview/domain/VideoFramePump';
import { RafVideoFramePump } from '@core/preview/infrastructure/RafVideoFramePump';
import { CanvasFootageFrameHolder } from '@core/preview/infrastructure/footage/CanvasFootageFrameHolder';
import { FootagePassFramePainter } from '@core/preview/infrastructure/footage/FootagePassFramePainter';
import type { FootagePlayer, HeldFootagePicture } from '@core/preview/infrastructure/footage/FootagePlayer';
import { FootagePassTimeSource } from '@core/preview/infrastructure/footage/FootagePassTimeSource';

type FootagePassPlayback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'stream'; readonly outputSec: number }
  | { readonly kind: 'still'; readonly outputSec: number }
  | { readonly kind: 'scrub'; readonly outputSec: number };

const IDLE: FootagePassPlayback = { kind: 'idle' };

/**
 * {@link FootagePlayer} for a video: one pass decoded through a decoder
 * of its own, each frame landing inside the pass held on a canvas of
 * the player's own.
 */
export class VideoFootagePlayer implements FootagePlayer {
  private readonly time: FootagePassTimeSource;
  private readonly holder = new CanvasFootageFrameHolder();
  private opened: OpenedPreviewSource | null = null;
  private pump: VideoFramePump | null = null;
  private playback: FootagePassPlayback = IDLE;
  private scrubbing = false;
  private disposed = false;

  constructor(
    readonly pass: FootagePass,
    private readonly blob: Blob,
    private readonly loader: PreviewSourceLoader,
    host: PlaybackTimeSource,
    private readonly onPainted: (pass: FootagePass) => void,
  ) {
    this.time = new FootagePassTimeSource(pass, host);
  }

  open(): void {
    void this.openSource();
  }

  isStreaming(): boolean {
    return this.playback.kind === 'stream';
  }

  stream(fromOutputSec: number): void {
    this.request({ kind: 'stream', outputSec: Math.max(fromOutputSec, this.pass.outputStartSec) });
  }

  still(atOutputSec: number): void {
    this.request({ kind: 'still', outputSec: atOutputSec });
  }

  scrub(atOutputSec: number): void {
    this.request({ kind: 'scrub', outputSec: atOutputSec });
  }

  idle(): void {
    this.request(IDLE);
  }

  dispose(): void {
    this.disposed = true;
    this.pump?.cancel();
    if (this.scrubbing) this.pump?.endScrubSession();
    this.pump = null;
    this.opened?.dispose();
    this.opened = null;
    this.holder.release();
  }

  picture(): HeldFootagePicture | null {
    return this.holder.held();
  }

  private async openSource(): Promise<void> {
    try {
      const opened = await this.loader.open(this.blob);
      if (this.disposed) {
        opened.dispose();
        return;
      }
      this.opened = opened;
      this.pump = this.buildPump(opened);
      this.apply(this.playback);
    } catch (error) {
      if (!this.disposed) console.error('[preview] a footage file could not be opened', error);
    }
  }

  // The pump runs on the pass's own clock, so its "output" positions are moments of the pass's video.
  private buildPump(opened: OpenedPreviewSource): VideoFramePump {
    const painter = new FootagePassFramePainter(this.holder, this.time, () => this.onPainted(this.pass));
    const straightThrough = new RenderTimeMap([]);
    return new RafVideoFramePump(opened.videoTrack, painter, this.time, () => straightThrough);
  }

  private request(playback: FootagePassPlayback): void {
    this.playback = playback;
    this.apply(playback);
  }

  private apply(playback: FootagePassPlayback): void {
    const pump = this.pump;
    if (!pump) return;
    if (playback.kind !== 'scrub' && this.scrubbing) {
      this.scrubbing = false;
      pump.endScrubSession();
    }
    switch (playback.kind) {
      case 'idle':
        pump.cancel();
        return;
      case 'stream':
        pump.startFromOutputTime(this.time.toSourceSec(playback.outputSec));
        return;
      case 'still':
        pump.cancel();
        // A still asked of a pass that is disposed before it lands has nowhere to go.
        pump.paintSingleFrameAt(this.time.toSourceSec(playback.outputSec)).catch(() => {});
        return;
      case 'scrub':
        if (!this.scrubbing) {
          pump.cancel();
          pump.beginScrubSession();
          this.scrubbing = true;
        }
        pump.paintScrubFrameAt(this.time.toSourceSec(playback.outputSec));
    }
  }
}
