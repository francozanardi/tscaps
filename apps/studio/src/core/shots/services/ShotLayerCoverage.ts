import { RenderTimeMap, TimeFragment } from '@tscaps/engine';
import type { FootageCover, FootageCoverage, FootageCoverageInput } from '@core/person-segmentation/domain/FootageCoverage';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';

/**
 * {@link FootageCoverage} from the shots' layers: the stretch of every
 * layer, whatever its placement and whether or not its file can be shown
 * yet. A split or an inset covers too — the cutout would be read off the
 * composed frame, and the actor's masks were measured on the bare video.
 * What a layer covers decides how captions are laid out, which has to be
 * the same in the preview and in any export.
 */
export class ShotLayerCoverage implements FootageCoverage {
  constructor(private readonly timing: ShotLayerTiming) {}

  covers(input: FootageCoverageInput): ReadonlyArray<FootageCover> {
    const timeMap = new RenderTimeMap(input.cuts.list());
    return this.timing
      .scheduleAll(input.shots, input.media, timeMap, input.videoDurationSec)
      .map(({ layer, stretch }) => ({
        layerId: layer.id,
        range: new TimeFragment(timeMap.toSourceTime(stretch.outputStartSec), timeMap.toSourceTime(stretch.outputEndSec)),
      }));
  }
}
