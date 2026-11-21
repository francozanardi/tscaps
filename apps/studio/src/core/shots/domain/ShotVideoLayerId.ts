/**
 * The id of a shot's own video as a layer: the box the video is drawn
 * in while the shot shows, which its style — a zoom, a crop — addresses.
 * Derived from the shot's id, so it holds as long as the shot does and
 * names no layer a file was ever added as.
 */
export class ShotVideoLayerId {
  private static readonly PREFIX = 'shot-video-';

  static of(shotId: string): string {
    return `${ShotVideoLayerId.PREFIX}${shotId}`;
  }

  /** The shot whose video `layerId` names, or null where it names a layer of another kind. */
  static shotIdOf(layerId: string): string | null {
    return layerId.startsWith(ShotVideoLayerId.PREFIX) ? layerId.slice(ShotVideoLayerId.PREFIX.length) : null;
  }
}
