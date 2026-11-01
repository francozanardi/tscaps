import type { Segment } from '@modules/document/Segment';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { SegmentWrapperRenderer } from '@modules/rendering/subtitle/SegmentWrapperRenderer';
import type { SubtreeAnimationSupport } from '@modules/rendering/subtitle/SubtreeAnimationSupport';
import type { AnimationStateFingerprint } from '@modules/rendering/subtitle/AnimationStateFingerprint';
import { SubtreeAnimationReading, type TimedEffect } from '@modules/rendering/subtitle/SubtreeAnimationReading';
import { profiler } from '@modules/profiling/Profiler';

/**
 * Mounts the segment's subtree and reads back what the browser reports
 * running on it, which covers every rule reaching those elements —
 * pseudo-elements and CSS the consumer supplied included.
 *
 * **Costly.** Every answer it cannot derive from an earlier one mounts
 * a subtree and forces a style recalculation, measured at ~0.35 ms.
 *
 * An animation that has not started holds its first keyframe and one
 * that has finished holds its last, so two timestamps whose animations
 * all sit in matching phases resolve to the same computed styles.
 * Anything mid-run, repeating forever, or reporting timing that cannot
 * be read is answered `null`.
 *
 * A reading is reused for as long as it decides the question on its
 * own, scoped to `classFingerprint`: two timestamps sharing one match
 * the same rules, so their animations can differ only in where the
 * clocks stand.
 *
 * Nothing is reused until a second reading has confirmed the first
 * predicted it. A stylesheet doing arithmetic on a clock moves its
 * phase boundaries at a different rate than the timestamp, and a single
 * reading cannot tell that apart from a clock followed exactly.
 */
export class SubtreeMountAnimationStateFingerprint implements AnimationStateFingerprint {
  private readonly readingByKey = new Map<string, SubtreeAnimationReading>();
  private readonly confirmedKeys = new Set<string>();
  private readonly alwaysMount = new Set<string>();
  private nextElementUid = 0;

  constructor(
    private readonly wrapperRenderer: SegmentWrapperRenderer,
    private readonly support: SubtreeAnimationSupport,
    private readonly width: number,
    private readonly height: number,
  ) {}

  async at(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    segmentIndex: number,
    classFingerprint: string,
  ): Promise<string | null> {
    if (!this.support.isAvailable()) return null;
    const key = `${style.kind}|${seg.id}|${classFingerprint}`;

    const remembered = this.readingByKey.get(key);
    if (remembered && this.confirmedKeys.has(key) && remembered.answersAt(t)) {
      return remembered.phaseKeyAt(t);
    }

    const reading = await this.read(style, seg, t, segmentIndex);
    if (reading === null) {
      this.retire(key);
      return null;
    }
    if (remembered && !remembered.predicts(reading)) {
      this.retire(key);
      return reading.phaseKeyAt(t);
    }
    if (!this.alwaysMount.has(key)) {
      if (remembered) this.confirmedKeys.add(key);
      this.readingByKey.set(key, reading);
    }
    return reading.phaseKeyAt(t);
  }

  private retire(key: string): void {
    this.alwaysMount.add(key);
    this.confirmedKeys.delete(key);
    this.readingByKey.delete(key);
  }

  private async read(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    segmentIndex: number,
  ): Promise<SubtreeAnimationReading | null> {
    const { html } = await profiler.time('SubtreeMountAnimationStateFingerprint.build', () =>
      this.wrapperRenderer.buildWrapperHtml(style, seg, t, segmentIndex, () => this.nextElementUid++));
    const effects = profiler.time('SubtreeMountAnimationStateFingerprint.read', () => this.readMounted(style, html));
    return effects === null ? null : new SubtreeAnimationReading(effects, t);
  }

  private readMounted(style: PreparedStyle, html: string): TimedEffect[] | null {
    const host = document.createElement('div');
    // Sized like the container a render paints into, so a rule reading
    // a container-relative length resolves it to the same value here.
    host.style.cssText = `position:relative;width:${this.width}px;height:${this.height}px;overflow:hidden;container-type:size;`;
    host.innerHTML = html;
    style.probeContainer.appendChild(host);
    try {
      return this.collectEffects(host);
    } finally {
      style.probeContainer.removeChild(host);
    }
  }

  private collectEffects(host: HTMLElement): TimedEffect[] | null {
    const effects: TimedEffect[] = [];
    for (const animation of host.getAnimations({ subtree: true })) {
      const timing = this.timingOf(animation);
      if (timing === null) return null;
      const address = this.addressOf(animation, host);
      if (address === null) return null;
      effects.push({ address, rule: this.ruleOf(animation), ...timing });
    }
    return effects;
  }

  /**
   * When the effect's active phase opens relative to the playhead, and
   * how long it lasts — `null` for either where the browser reports
   * timing this cannot read as plain milliseconds.
   */
  private timingOf(animation: Animation): Pick<TimedEffect, 'startsInMs' | 'activeDurationMs'> | null {
    const effect = animation.effect;
    if (!effect) return null;
    const timing = effect.getComputedTiming();
    const delayMs = this.milliseconds(timing.delay);
    const localTimeMs = this.milliseconds(timing.localTime);
    if (delayMs === null || localTimeMs === null) return null;
    return {
      startsInMs: delayMs - localTimeMs,
      activeDurationMs: this.milliseconds(timing.activeDuration),
    };
  }

  /**
   * Where the effect lands, as the child-index path down from `host`
   * plus the pseudo-element it targets. Two subtrees agree on it only
   * when the same node in the same position carries the same effect.
   */
  private addressOf(animation: Animation, host: HTMLElement): string | null {
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect) || effect.target === null) return null;
    const path: number[] = [];
    for (let element: Element = effect.target; element !== host;) {
      const parent = element.parentElement;
      if (parent === null) return null;
      path.push([...parent.children].indexOf(element));
      element = parent;
    }
    return `${path.reverse().join('.')}${effect.pseudoElement ?? ''}`;
  }

  /** The `@keyframes` rule behind the effect where the browser names one. */
  private ruleOf(animation: Animation): string {
    if (!('animationName' in animation)) return animation.id;
    const name: unknown = animation.animationName;
    return typeof name === 'string' ? name : animation.id;
  }

  /** A timing figure as finite milliseconds, or `null` where it is absent, infinite, or not a plain number. */
  private milliseconds(value: number | string | CSSNumericValue | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
