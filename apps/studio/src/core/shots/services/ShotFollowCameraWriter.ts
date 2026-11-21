import { ShotLayerCss } from '@core/shots/domain/ShotLayerCss';
import type { FollowFraming, StagedShotFollow } from '@core/shots/domain/StagedShotFollow';

/** A followed box as the stylesheet addresses it. */
export interface AddressedShotFollow {
  readonly selector: string;
  readonly follow: StagedShotFollow;
}

const KEYFRAMES_PREFIX = 'tscaps-shot-follow-';
const PRECISION = 5;

/**
 * Writes the cameras that follow a person: per followed box, keyframes
 * carrying its geometry through its framings (one for a camera that
 * holds still, run out at once), as a camera preset's
 * carry it between two (`presets/layer/animation/layer-camera-move.scss`),
 * and the camera animation playing them over the box's whole stretch.
 * Each framing places the box as the framework does
 * (`presets/layer/stage/stage.scss`): grown by the camera's closeness and
 * moved to keep the share looked at, its picture placed at that share,
 * or in the middle where it is fitted. An axis with no room keeps what
 * the box looks at without the follow.
 */
export class ShotFollowCameraWriter {
  /** The cascade layer holding every followed box's rule and keyframes; empty for none. */
  write(follows: ReadonlyArray<AddressedShotFollow>): string {
    const blocks = follows.filter(({ follow }) => follow.framings.length > 0).map(({ selector, follow }, index) => {
      const name = `${KEYFRAMES_PREFIX}${index}`;
      const rule = `${selector} { ${ShotLayerCss.CAMERA_ANIMATION}: ${name} ${this.durationOf(follow.framings)} linear var(--on-layer-starts) 1 both; }`;
      return `${rule}\n@keyframes ${name} {\n${this.stopsOf(follow.framings).join('\n')}\n}`;
    });
    if (blocks.length === 0) return '';
    return `@layer ${ShotLayerCss.FOLLOW_LAYER} {\n${blocks.join('\n')}\n}`;
  }

  /**
   * How long the camera runs: over the box's whole stretch, or, for a
   * camera that holds one framing, a millisecond, after which it stays
   * on it. An animation that has run out leaves its box still, which
   * the export reads once instead of on every frame.
   */
  private durationOf(framings: ReadonlyArray<FollowFraming>): string {
    return framings.length === 1 ? '1ms' : 'var(--layer-duration)';
  }

  /** One keyframe per framing, the first held from the start and the last to the end. */
  private stopsOf(framings: ReadonlyArray<FollowFraming>): string[] {
    const first = framings[0]!;
    const last = framings[framings.length - 1]!;
    const stops = framings.map((framing) => this.stop(`${this.number(framing.percent)}%`, framing));
    return [
      ...(first.percent > 0 ? [this.stop('0%', first)] : []),
      ...stops,
      ...(last.percent < 100 ? [this.stop('100%', last)] : []),
    ];
  }

  private stop(at: string, framing: FollowFraming): string {
    const x = framing.x === null ? 'var(--layer-picture-x-used)' : this.number(framing.x);
    const y = framing.y === null ? 'var(--layer-picture-y-used)' : this.number(framing.y);
    const scale = 'var(--layer-picture-scale-used)';
    const placed = (share: string): string => `calc((var(--layer-picture-fitted, 0) * 0.5 + (1 - var(--layer-picture-fitted, 0)) * ${share}) * 100%)`;
    return `  ${at} {`
      + ` left: calc(var(--layer-box-left) - (${scale} - 1) * var(--layer-box-width) * ${x});`
      + ` top: calc(var(--layer-box-top) - (${scale} - 1) * var(--layer-box-height) * ${y});`
      + ` width: calc(var(--layer-box-width) * ${scale});`
      + ` height: calc(var(--layer-box-height) * ${scale});`
      + ` object-position: ${placed(x)} ${placed(y)}; }`;
  }

  private number(value: number): string {
    return `${Number(value.toFixed(PRECISION))}`;
  }
}
