import type { RenderTimeMap } from '@tscaps/engine';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { ScheduledShot } from '@core/shots/domain/ScheduledShot';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { FollowFraming, StagedShotFollow } from '@core/shots/domain/StagedShotFollow';
import type { ShotFollowCrop } from '@core/shots/services/ShotFollowCrop';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { CameraPathPoint, FollowPlan } from '@core/subject-tracking/domain/FollowPlan';
import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';
import type { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';

// How often the camera's path is written out, in seconds of the output.
const FRAMING_STEP_SEC = 0.25;

/**
 * Works out how each box showing a shot's own video follows the person
 * its shot follows, as the project stands: the crop it has (the output
 * frame's crop of the picture, held as close as its camera holds it),
 * the path a camera operator would take with that crop through every
 * head the shot keeps, and the part of that path inside the source
 * stretch the box shows, written out on the box's own clock, which runs
 * on output time, so a cut inside the stretch shortens the move rather
 * than leaving it behind the picture. Shots that keep the same heads,
 * as the shots of one reframed part do, plan the same path, so the
 * camera runs on across the cut between them without a jump.
 */
export class ShotFollowStager {
  constructor(
    private readonly crops: ShotFollowCrop,
    private readonly paths: CameraPathPlanner,
  ) {}

  /**
   * The follows of the boxes in `videos` (each a shot's own video over
   * the stretch of the output it is drawn over) whose shot follows
   * someone, on a frame of `frame`'s size in `outputFrame`. None while
   * the frame's size is not known.
   */
  stage(
    shots: ShotPartition,
    videos: ReadonlyArray<ScheduledShot>,
    timeMap: RenderTimeMap,
    frame: VideoLayout | null,
    outputFrame: OutputFrame,
  ): StagedShotFollow[] {
    if (frame === null || !(frame.width > 0 && frame.height > 0)) return [];
    return videos.flatMap((video) => {
      const follow = shots.list().find((shot) => shot.id === video.shotId)?.follow;
      if (follow === undefined) return [];
      const staged = this.staged(video, follow, this.crops.of(shots, video.shotId, follow.pictureAspectRatio, frame, outputFrame), timeMap);
      return staged === null ? [] : [staged];
    });
  }

  /**
   * The part of the picture the camera of `shotId` shows at `sourceSec`
   * of the source, as shares of it, planned as the stylesheet plans it
   * for a box drawing the shot's video over `stretch` of the source; on
   * a frame of `frame`'s size in `outputFrame`. Null where the shot
   * follows nobody, or the frame's size is not known.
   */
  viewAt(
    shots: ShotPartition,
    shotId: string,
    stretch: SourceStretch,
    sourceSec: number,
    frame: VideoLayout | null,
    outputFrame: OutputFrame,
  ): NormalizedBbox | null {
    if (frame === null || !(frame.width > 0 && frame.height > 0)) return null;
    const follow = shots.list().find((shot) => shot.id === shotId)?.follow;
    if (follow === undefined) return null;
    const crop = this.crops.of(shots, shotId, follow.pictureAspectRatio, frame, outputFrame);
    const plan = this.paths.plan(follow.heads, crop, this.plannedOver(follow, stretch), null, follow.untilFound ?? null);
    if (plan === null) return null;
    const centre = this.centreAt(plan.points, sourceSec);
    const minX = this.sideStart(centre.x, crop.width);
    const minY = this.sideStart(centre.y, crop.height);
    return { minX, minY, maxX: minX + Math.min(1, crop.width), maxY: minY + Math.min(1, crop.height) };
  }

  /** Where a side of `side` starts with its middle at `centre`, kept inside the picture: at 0 where it spans it. */
  private sideStart(centre: number, side: number): number {
    return Math.min(Math.max(0, 1 - side), Math.max(0, centre - side / 2));
  }

  private staged(video: ScheduledShot, follow: ShotFollow, crop: CropSize, timeMap: RenderTimeMap): StagedShotFollow | null {
    const lengthSec = video.outputEndSec - video.outputStartSec;
    if (!(lengthSec > 0)) return null;
    const stretch = { startSec: timeMap.toSourceTime(video.outputStartSec), endSec: timeMap.toSourceTime(video.outputEndSec) };
    const plan = this.paths.plan(follow.heads, crop, this.plannedOver(follow, stretch), null, follow.untilFound ?? null);
    if (plan === null) return null;
    return { layerId: ShotVideoLayerId.of(video.shotId), framings: this.framingsOf(plan, crop, video, lengthSec, stretch, timeMap) };
  }

  /**
   * The crop's framings through the box's stretch: one where the crop
   * holds still, since every step would repeat it and each costs the
   * export on every frame, else one every step and one at the end.
   */
  private framingsOf(
    plan: FollowPlan,
    crop: CropSize,
    video: ScheduledShot,
    lengthSec: number,
    stretch: SourceStretch,
    timeMap: RenderTimeMap,
  ): FollowFraming[] {
    if (plan.kind !== 'moving') return [this.framingAt(plan, crop, stretch.startSec, 0)];
    const framings: FollowFraming[] = [];
    for (let outputSec = 0; outputSec < lengthSec; outputSec += FRAMING_STEP_SEC) {
      framings.push(this.framingAt(plan, crop, timeMap.toSourceTime(video.outputStartSec + outputSec), (outputSec / lengthSec) * 100));
    }
    framings.push(this.framingAt(plan, crop, stretch.endSec, 100));
    return framings;
  }

  /** The stretch the path is planned over: from the first head to the last, and at least the box's own stretch. */
  private plannedOver(follow: ShotFollow, stretch: SourceStretch): SourceStretch {
    const first = follow.heads[0]!.sourceSec;
    const last = follow.heads[follow.heads.length - 1]!.sourceSec;
    return { startSec: Math.min(first, stretch.startSec), endSec: Math.max(last, stretch.endSec) };
  }

  /** Where the crop is at `sourceSec`, as the share of what it leaves out on each axis it has room on. */
  private framingAt(plan: FollowPlan, crop: CropSize, sourceSec: number, percent: number): FollowFraming {
    const centre = this.centreAt(plan.points, sourceSec);
    return { percent, x: this.leftOutShare(centre.x, crop.width), y: this.leftOutShare(centre.y, crop.height) };
  }

  /** The share of what a crop of `side` leaves out that puts its middle at `centre`; null where it leaves nothing out. */
  private leftOutShare(centre: number, side: number): number | null {
    if (side >= 1) return null;
    return Math.min(1, Math.max(0, (centre - side / 2) / (1 - side)));
  }

  /** The path's centre at `sec`, on the straight line between its points either side; the first or last outside them. */
  private centreAt(points: ReadonlyArray<CameraPathPoint>, sec: number): CameraPathPoint {
    const after = points.findIndex((point) => point.sourceSec >= sec);
    if (after === -1) return points[points.length - 1]!;
    if (after === 0) return points[0]!;
    const [previous, next] = [points[after - 1]!, points[after]!];
    const share = (sec - previous.sourceSec) / (next.sourceSec - previous.sourceSec);
    return { sourceSec: sec, x: previous.x + (next.x - previous.x) * share, y: previous.y + (next.y - previous.y) * share };
  }
}
