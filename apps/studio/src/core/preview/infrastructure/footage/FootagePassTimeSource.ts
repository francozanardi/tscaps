import type { FootagePass } from '@tscaps/engine/advanced';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';

/**
 * Reads the host's playback as the moment of one pass's own video: the
 * pass's start plays its first moment, and the reading runs on with the
 * host from there, below that first moment before the pass opens.
 */
export class FootagePassTimeSource implements PlaybackTimeSource {
  constructor(
    private readonly pass: FootagePass,
    private readonly host: PlaybackTimeSource,
  ) {}

  isRunning(): boolean {
    return this.host.isRunning();
  }

  currentOutputTimeSec(): number {
    return this.toSourceSec(this.host.currentOutputTimeSec());
  }

  /** The moment of the pass's video at output `outputSec`. */
  toSourceSec(outputSec: number): number {
    return this.pass.layer.sourceStartSec + (outputSec - this.pass.outputStartSec);
  }

  /** Whether the host's playback is inside the pass right now. */
  coversNow(): boolean {
    const outputSec = this.host.currentOutputTimeSec();
    return outputSec >= this.pass.outputStartSec && outputSec < this.pass.outputEndSec;
  }
}
