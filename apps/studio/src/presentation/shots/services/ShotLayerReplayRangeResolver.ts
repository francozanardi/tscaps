import type { RenderTimeMap } from '@tscaps/engine';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';

/** A stretch of the source video, in seconds. */
export interface ShotLayerReplayRange {
  readonly startSec: number;
  readonly endSec: number;
}

// A layer shows over a half-open stretch, so its own end is the first
// instant it is gone, and whatever was editing it closes with it. A
// sixtieth is the shortest frame the editor assumes anywhere.
const LAST_FRAME_SEC = 1 / 60;
// Played past the end of an entrance, and before the start of an exit:
// a few frames, so the motion is seen to settle, or to start from rest,
// without the replay running on long after it.
const PADDING_SEC = 0.1;

/**
 * Which stretch of the video plays a layer: one end of it — from the
 * moment it comes in to just after its entrance has played, or from
 * just before its exit to the last frame it shows — or all of it (a
 * shot's own video's, at its shot's ends). Never longer than the layer,
 * so a replay never leaves it.
 */
export class ShotLayerReplayRangeResolver {
  constructor(private readonly timing: ShotLayerTiming) {}

  /**
   * The stretch, in source time, that plays `edge` of the layer
   * `layerId`, whose motion there lasts `edgeSec` (at most half the
   * layer, as its CSS plays it); null where the layer is gone or nothing
   * of it reaches the output. `videoDurationSec` closes the last shot.
   */
  resolve(
    layerId: string,
    edge: 'entrance' | 'exit',
    edgeSec: number,
    shots: ShotPartition,
    media: MediaAssetCatalog,
    timeMap: RenderTimeMap,
    videoDurationSec: number,
  ): ShotLayerReplayRange | null {
    const stretch = this.outputStretchOf(layerId, shots, media, timeMap, videoDurationSec);
    if (stretch === null) return null;
    const { outputStartSec, outputEndSec } = stretch;
    if (!Number.isFinite(outputEndSec)) return null;
    const lastSec = Math.max(outputStartSec, outputEndSec - LAST_FRAME_SEC);
    const playedSec = Math.min(edgeSec, (outputEndSec - outputStartSec) / 2) + PADDING_SEC;
    const fromSec = edge === 'entrance' ? outputStartSec : Math.max(outputStartSec, lastSec - playedSec);
    const toSec = edge === 'entrance' ? Math.min(lastSec, outputStartSec + playedSec) : lastSec;
    return this.sourceRange(fromSec, toSec, timeMap);
  }

  /**
   * The whole stretch the layer `layerId` shows over, in source time,
   * from the moment it comes in to its last frame; null where the layer
   * is gone or nothing of it reaches the output.
   */
  wholeOf(
    layerId: string,
    shots: ShotPartition,
    media: MediaAssetCatalog,
    timeMap: RenderTimeMap,
    videoDurationSec: number,
  ): ShotLayerReplayRange | null {
    const stretch = this.outputStretchOf(layerId, shots, media, timeMap, videoDurationSec);
    if (stretch === null || !Number.isFinite(stretch.outputEndSec)) return null;
    const lastSec = Math.max(stretch.outputStartSec, stretch.outputEndSec - LAST_FRAME_SEC);
    return this.sourceRange(stretch.outputStartSec, lastSec, timeMap);
  }

  private sourceRange(fromSec: number, toSec: number, timeMap: RenderTimeMap): ShotLayerReplayRange | null {
    const startSec = timeMap.toSourceTime(fromSec);
    const endSec = timeMap.toSourceTime(toSec);
    return endSec > startSec ? { startSec, endSec } : null;
  }

  private outputStretchOf(
    layerId: string,
    shots: ShotPartition,
    media: MediaAssetCatalog,
    timeMap: RenderTimeMap,
    videoDurationSec: number,
  ): { outputStartSec: number; outputEndSec: number } | null {
    const shotId = ShotVideoLayerId.shotIdOf(layerId);
    if (shotId !== null) {
      return this.timing.scheduleShotVideos(shots, timeMap, videoDurationSec).find((shot) => shot.shotId === shotId) ?? null;
    }
    return this.timing.scheduleAll(shots, media, timeMap, videoDurationSec)
      .find((candidate) => candidate.layer.id === layerId)?.stretch ?? null;
  }
}
