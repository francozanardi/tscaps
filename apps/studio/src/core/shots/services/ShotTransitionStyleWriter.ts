import { ShotLayerCss } from '@core/shots/domain/ShotLayerCss';
import type { ShotLayerStageCss } from '@core/shots/domain/ShotLayerStageCss';
import type { StagedShotTransition } from '@core/shots/services/ShotTransitionLayerBuilder';

/** A transition's box as the stylesheet addresses it. */
export interface AddressedShotTransition {
  readonly selector: string;
  readonly transition: StagedShotTransition;
}

const KEYFRAMES_PREFIX = 'tscaps-shot-transition-';

/**
 * Writes how each transition between shots plays, for the stage the
 * shot layers are resolved on: the transitions' stylesheet, compiled
 * from the template library (`ShotLayerStageCss.shotTransitions`,
 * `presets/layer/stage/shot-transitions.scss`), which holds every
 * kind's keyframes and plays any transition's box from three properties;
 * and one rule per transition setting them: the keyframes of its kind,
 * its length, and how much of its first half the output's start cuts
 * off, so its midpoint stays on the cut.
 */
export class ShotTransitionStyleWriter {
  constructor(private readonly stageCss: ShotLayerStageCss) {}

  /** The cascade layer holding every transition's rule and the stylesheet they play by; empty for none. */
  write(transitions: ReadonlyArray<AddressedShotTransition>): string {
    if (transitions.length === 0) return '';
    const rules = transitions.map(({ selector, transition }) => `${selector} {`
      + ` --shot-transition-name: ${KEYFRAMES_PREFIX}${transition.kind};`
      + ` --shot-transition-duration: ${Number(transition.durationSec.toFixed(4))}s;`
      + ` --shot-transition-clipped: ${Number(transition.clippedSec.toFixed(4))}s; }`);
    return `@layer ${ShotLayerCss.TRANSITION_LAYER} {\n${[...rules, this.stageCss.shotTransitions].join('\n')}\n}`;
  }
}
