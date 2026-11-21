import type { RenderTimeMap } from '@tscaps/engine';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ScheduledShot } from '@core/shots/domain/ScheduledShot';
import type { ScheduledShotLayer, ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerStretch } from '@core/shots/domain/ShotLayerStretch';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { OUTPUT_TIME_TOLERANCE_SEC } from '@core/cuts/domain/OutputTimeTolerance';

/**
 * Lays shot layers on the output timeline.
 *
 * A layer opens where its shot opens and shows over its run: its own
 * shot, or every shot through the one it names. It runs on output time,
 * so a cut inside the run shortens it and never makes the layer jump. A
 * video runs for the shorter of its picked stretch and the run, or,
 * looping, for the whole run, starting its stretch over each time. A
 * picture, a GIF or a graphic ignores the stretch and spans the run; a
 * GIF plays its own frames from its start, looping, for as long as the
 * run lasts. A shot's own video shows for the whole shot, and for every
 * shot it is drawn through. The preview, the export and where text may
 * go behind the actor all read when a layer shows from here, so they
 * cannot disagree.
 */
export class ShotLayerTiming {
  constructor(private readonly assets: ShotLayerAssetReader) {}

  /**
   * Every layer of `shots` that reaches the output, bottom to top: the
   * files in the order of their shots and, inside a shot, of its layers,
   * then the graphics in that same order, so that where layers of
   * different shots show together a graphic is still above every file
   * and a later shot's layer above an earlier one's. `videoDurationSec`
   * closes the last shot; null leaves it open.
   */
  scheduleAll(
    shots: ShotPartition,
    media: MediaAssetCatalog,
    timeMap: RenderTimeMap,
    videoDurationSec: number | null,
  ): ScheduledShotLayer[] {
    const list = shots.list();
    const files: ScheduledShotLayer[] = [];
    const graphics: ScheduledShotLayer[] = [];
    for (const shot of list) {
      for (const layer of shot.layers) {
        const run = shots.runOf(layer.id);
        const last = run[run.length - 1] ?? shot;
        const endSec = list[list.indexOf(last) + 1]?.startSec ?? videoDurationSec ?? Infinity;
        const asset = this.assets.assetOf(layer, media);
        const stretch = this.stretchOf(layer, asset, shot.startSec, endSec, timeMap);
        if (stretch === null) continue;
        ('graphic' in layer ? graphics : files).push({ layer, stretch, asset });
      }
    }
    return [...files, ...graphics];
  }

  /**
   * Every shot of `shots` that reaches the output, in order, over the
   * stretch of the output it shows; a shot cut away entirely is left
   * out, and so is a last shot with no end while `videoDurationSec`,
   * which closes it, is null: what shows for a shot's whole length
   * needs one.
   */
  scheduleShots(shots: ShotPartition, timeMap: RenderTimeMap, videoDurationSec: number | null): ScheduledShot[] {
    const list = shots.list();
    const scheduled: ScheduledShot[] = [];
    for (const [index, shot] of list.entries()) {
      const endSec = list[index + 1]?.startSec ?? videoDurationSec ?? Infinity;
      const outputStartSec = timeMap.toOutputTime(shot.startSec);
      const outputEndSec = timeMap.toOutputTime(endSec);
      if (Number.isFinite(outputEndSec) && outputEndSec - outputStartSec >= OUTPUT_TIME_TOLERANCE_SEC) scheduled.push({ shotId: shot.id, outputStartSec, outputEndSec });
    }
    return scheduled;
  }

  /**
   * Every shot of `shots` whose own video is drawn, in order, over the
   * stretch of the output it is drawn over: its own shot, and every shot
   * its video runs through, which get no stretch of their own. A stretch
   * that plays nothing is left out, and so is a last one with no end
   * while `videoDurationSec`, which closes it, is null.
   */
  scheduleShotVideos(shots: ShotPartition, timeMap: RenderTimeMap, videoDurationSec: number | null): ScheduledShot[] {
    const list = shots.list();
    const scheduled: ScheduledShot[] = [];
    let index = 0;
    while (index < list.length) {
      const shot = list[index]!;
      const covered = Math.max(1, shots.videoRunOf(shot.id).length);
      const endSec = list[index + covered]?.startSec ?? videoDurationSec ?? Infinity;
      const outputStartSec = timeMap.toOutputTime(shot.startSec);
      const outputEndSec = timeMap.toOutputTime(endSec);
      if (Number.isFinite(outputEndSec) && outputEndSec - outputStartSec >= OUTPUT_TIME_TOLERANCE_SEC) scheduled.push({ shotId: shot.id, outputStartSec, outputEndSec });
      index += covered;
    }
    return scheduled;
  }

  /**
   * `runStartSec` and `runEndSec`, in source time, are where the shots
   * the layer shows on open and end; `asset` is null for a file of no
   * known type, which spans them like a picture. Null when nothing of
   * the layer reaches the output — its shots are cut away, or its
   * stretch holds nothing.
   */
  stretchOf(
    layer: ShotLayer,
    asset: ShotLayerAsset | null,
    runStartSec: number,
    runEndSec: number,
    timeMap: RenderTimeMap,
  ): ShotLayerStretch | null {
    const outputStartSec = timeMap.toOutputTime(runStartSec);
    const runOutputEndSec = timeMap.toOutputTime(runEndSec);
    if (asset === null || asset.kind !== 'video' || !('mediaId' in layer)) {
      if (!(runOutputEndSec - outputStartSec >= OUTPUT_TIME_TOLERANCE_SEC)) return null;
      return { outputStartSec, outputEndSec: runOutputEndSec, sourceStartSec: 0, sourcePassSec: Infinity };
    }
    const stretchEndSec = layer.outSec ?? asset.durationSec ?? Infinity;
    const sourcePassSec = stretchEndSec - layer.inSec;
    if (!(sourcePassSec > 0)) return null;
    const outputEndSec = layer.loop ? runOutputEndSec : Math.min(runOutputEndSec, outputStartSec + sourcePassSec);
    if (!(outputEndSec - outputStartSec >= OUTPUT_TIME_TOLERANCE_SEC)) return null;
    return { outputStartSec, outputEndSec, sourceStartSec: layer.inSec, sourcePassSec };
  }
}
