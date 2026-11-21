import type { FootageLayer } from '@tscaps/engine';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { OutputFrameLayerId } from '@core/output-frame/domain/OutputFrameLayerId';
import type { ScheduledShot } from '@core/shots/domain/ScheduledShot';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { BuiltShotLayer } from '@core/shots/services/ShotFootageLayerBuilder';

/** What decides the boxes the video's own picture is drawn in. */
export interface VideoPictureInput {
  readonly frame: OutputFrame;
  /** How long the output runs, or null when that is not known. */
  readonly outputDurationSec: number | null;
  /**
   * The shots whose own video is drawn, in order, each over the stretch
   * it is drawn over, which reaches past its own shot where its video
   * runs through later ones; empty for a video not cut into shots yet.
   */
  readonly shots: ReadonlyArray<ScheduledShot>;
  /** Whether some shot's own video carries a style of its own: a zoom, a crop. */
  readonly styledVideo: boolean;
}

/**
 * The footage layers the video's own picture is drawn in, bottom to
 * top, to go beneath every shot layer: one box per shot whose own
 * video is drawn, over the stretch it is drawn over (`ShotVideoLayerId`),
 * which is where a shot's zoom or crop is written; or, for a video not cut into shots, one box
 * over the whole output (`OutputFrameLayerId.VIDEO`). Beneath them, for
 * a video fitted into a frame of another shape over its blurred copy,
 * that copy over the whole output.
 *
 * None where nothing asks the video to be drawn other than as it is: its
 * own shape, and no shot's video styled. How each box is drawn is the
 * stylesheet's — `OutputFrameCss` for the frame, each shot's style for
 * the rest. The preview and the export both take them from here, so
 * they cannot disagree.
 */
export class VideoPictureFootageBuilder {
  build(input: VideoPictureInput): BuiltShotLayer[] {
    if (input.frame.isOriginal() && !input.styledVideo) return [];
    const extent = this.outputExtent(input);
    if (extent === null) return [];
    const backdrop = input.frame.fit === 'fit' && input.frame.backdrop === 'blur' && !input.frame.isOriginal()
      ? [this.built(OutputFrameLayerId.BACKDROP, 0, extent)]
      : [];
    const videos = input.shots.length > 0
      ? input.shots.map((shot) => this.built(ShotVideoLayerId.of(shot.shotId), shot.outputStartSec, shot.outputEndSec))
      : [this.built(OutputFrameLayerId.VIDEO, 0, extent)];
    return [...backdrop, ...videos];
  }

  /** Where the output ends: its length, or else where its last shot ends; null while neither is known. */
  private outputExtent(input: VideoPictureInput): number | null {
    if (input.outputDurationSec !== null && input.outputDurationSec > 0) return input.outputDurationSec;
    const lastShot = input.shots[input.shots.length - 1];
    return lastShot === undefined ? null : lastShot.outputEndSec;
  }

  private built(id: string, outputStartSec: number, outputEndSec: number): BuiltShotLayer {
    return {
      footage: this.layerOf(id, outputStartSec, outputEndSec),
      // Its box never takes a file's shape: it covers the frame.
      staged: { layerId: id, assetAspectRatio: null },
    };
  }

  private layerOf(id: string, outputStartSec: number, outputEndSec: number): FootageLayer {
    return {
      id,
      source: { kind: 'source-picture' },
      outputStartSec,
      outputEndSec,
      sourceStartSec: 0,
      sourcePassSec: Infinity,
    };
  }
}
