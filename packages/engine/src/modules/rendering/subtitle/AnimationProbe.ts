import { CssVariable } from '@modules/document/CssVariable';
import type { Segment } from '@modules/document/Segment';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { AbstractAnim } from '@modules/rendering/subtitle/AbstractAnim';

const FINGERPRINT_BASE_S = 10000;

/**
 * Decides whether a render item should redraw every frame: builds
 * throw-away DOM chains matching the CSS classes the engine emits,
 * reads back resolved `animation-duration` / `animation-delay` from
 * `getComputedStyle`, and decodes each timing back to the CSS
 * variable that anchored its window. Caches per `(style, class
 * chain)` so the same chain is probed at most once. `clear` empties
 * the cache.
 */
export class AnimationProbe {
  private readonly timingByKey = new Map<string, AbstractAnim[]>();

  isItemAnimating(style: PreparedStyle, seg: Segment, t: number): boolean {
    // Letter-level CSS typically combines time vars via calc(), which
    // destroys the fingerprint-based probe; treat the segment as
    // always animating in that mode and redraw every frame.
    if (style.rendering.splitWordsIntoLetters) return true;
    // Styles that bake the underlying video frame into their visuals
    // change every tick by definition — no two timestamps share state.
    if (style.rendering.videoFrame.required) return true;
    // Filter definitions whose materialized output can vary with
    // `currentTime` likewise force per-frame redraw; conservatively
    // treat any non-empty filter set as time-varying.
    if (!style.filters.definitions.isEmpty()) return true;

    const segClasses = seg.getCssClasses(t);
    if (this.evalAnims(this.segmentTiming(style, segClasses), t, seg.time.start, seg.time.end)) return true;

    return [...seg.lines].some((line) => {
      const lineClasses = line.getCssClasses(t);
      if (this.evalAnims(this.lineTiming(style, lineClasses, segClasses), t, seg.time.start, seg.time.end, line.time.start, line.time.end)) return true;

      return [...line.words].some((word) => {
        const wordClasses = word.getCssClasses(t);
        return this.evalAnims(this.wordTiming(style, wordClasses, lineClasses, segClasses), t, seg.time.start, seg.time.end, line.time.start, line.time.end, word.time.start, word.time.end);
      });
    });
  }

  clear(): void {
    this.timingByKey.clear();
  }

  private wordTiming(style: PreparedStyle, wordClasses: string[], lineClasses: string[], segClasses: string[]): AbstractAnim[] {
    const key = `${style.kind}|w:${wordClasses.join(' ')}|l:${lineClasses.join(' ')}|s:${segClasses.join(' ')}`;
    return this.getOrProbeTiming(key, () => {
      const seg = document.createElement('div'); seg.className = segClasses.join(' ');
      const line = document.createElement('div'); line.className = lineClasses.join(' ');
      const word = document.createElement('span'); word.className = wordClasses.join(' ');
      this.injectProbeMagic(word);
      line.appendChild(word); seg.appendChild(line);
      style.probeContainer.appendChild(seg);
      const timing = this.readAnimTimings(word);
      style.probeContainer.removeChild(seg);
      return timing;
    });
  }

  private lineTiming(style: PreparedStyle, lineClasses: string[], segClasses: string[]): AbstractAnim[] {
    const key = `${style.kind}|l:${lineClasses.join(' ')}|s:${segClasses.join(' ')}`;
    return this.getOrProbeTiming(key, () => {
      const seg = document.createElement('div'); seg.className = segClasses.join(' ');
      const line = document.createElement('div'); line.className = lineClasses.join(' ');
      this.injectProbeMagic(line);
      seg.appendChild(line); style.probeContainer.appendChild(seg);
      const timing = this.readAnimTimings(line);
      style.probeContainer.removeChild(seg);
      return timing;
    });
  }

  private segmentTiming(style: PreparedStyle, segClasses: string[]): AbstractAnim[] {
    const key = `${style.kind}|s:${segClasses.join(' ')}`;
    return this.getOrProbeTiming(key, () => {
      const seg = document.createElement('div'); seg.className = segClasses.join(' ');
      this.injectProbeMagic(seg);
      style.probeContainer.appendChild(seg);
      const timing = this.readAnimTimings(seg);
      style.probeContainer.removeChild(seg);
      return timing;
    });
  }

  // Each CssVariable gets a fingerprint-shaped duration value so the
  // computed `animation-delay` on a probed element identifies which
  // variable a rule consumed.
  private injectProbeMagic(el: HTMLElement): void {
    Object.values(CssVariable).forEach((cssVar, index) => {
      el.style.setProperty(cssVar, `${(index + 1) * FINGERPRINT_BASE_S}s`);
    });
  }

  private getOrProbeTiming(key: string, probe: () => AbstractAnim[]): AbstractAnim[] {
    let timing = this.timingByKey.get(key);
    if (!timing) {
      timing = probe();
      this.timingByKey.set(key, timing);
    }
    return timing;
  }

  private readAnimTimings(el: HTMLElement): AbstractAnim[] {
    const computed = window.getComputedStyle(el);
    const durations = this.parseDurationsS(computed.animationDuration);
    const delays = this.parseDurationsS(computed.animationDelay);
    const iterations = computed.animationIterationCount.split(',').map((s) => s.trim());

    if (durations.every((d) => d === 0)) return [];

    const anims: AbstractAnim[] = [];
    const variables = Object.values(CssVariable);

    for (let i = 0; i < durations.length; i++) {
      const d = durations[i] ?? 0;
      if (d === 0) continue;
      const dl = delays[i] ?? 0;
      const fingerprintIndex = (dl / FINGERPRINT_BASE_S) - 1;
      const cssVar = variables[fingerprintIndex];
      if (!cssVar) continue;
      const isInfinite = (iterations[i] ?? '1') === 'infinite';
      anims.push({ cssVar, durationS: isInfinite ? Infinity : d + 0.05 });
    }
    return anims;
  }

  private parseDurationsS(value: string): number[] {
    if (!value) return [0];
    return value.split(',').map((s) => {
      s = s.trim();
      if (s.endsWith('ms')) return parseFloat(s) / 1000;
      if (s.endsWith('s')) return parseFloat(s);
      return 0;
    });
  }

  private evalAnims(anims: AbstractAnim[], t: number, segStart: number, segEnd: number, lineStart?: number, lineEnd?: number, wordStart?: number, wordEnd?: number): boolean {
    return anims.some((a) => {
      let startT: number;
      switch (a.cssVar) {
        case CssVariable.SECTION_STARTS:
        case CssVariable.SECTION_ENDS:
          // Section-level animations are not yet wired into per-frame
          // timing — treat them as never active.
          return false;
        case CssVariable.SEGMENT_STARTS: startT = segStart; break;
        case CssVariable.SEGMENT_ENDS: startT = segEnd; break;

        case CssVariable.LINE_NOT_NARRATED_YET_STARTS: startT = segStart; break;
        case CssVariable.LINE_NOT_NARRATED_YET_ENDS: startT = lineStart ?? segStart; break;
        case CssVariable.LINE_BEING_NARRATED_STARTS: startT = lineStart ?? segStart; break;
        case CssVariable.LINE_BEING_NARRATED_ENDS: startT = lineEnd ?? segEnd; break;
        case CssVariable.LINE_ALREADY_NARRATED_STARTS: startT = lineEnd ?? segEnd; break;
        case CssVariable.LINE_ALREADY_NARRATED_ENDS: startT = segEnd; break;

        case CssVariable.WORD_NOT_NARRATED_YET_STARTS: startT = segStart; break;
        case CssVariable.WORD_NOT_NARRATED_YET_ENDS: startT = wordStart ?? segStart; break;
        case CssVariable.WORD_BEING_NARRATED_STARTS: startT = wordStart ?? segStart; break;
        case CssVariable.WORD_BEING_NARRATED_ENDS: startT = wordEnd ?? segEnd; break;
        case CssVariable.WORD_ALREADY_NARRATED_STARTS: startT = wordEnd ?? segEnd; break;
        case CssVariable.WORD_ALREADY_NARRATED_ENDS: startT = segEnd; break;

        default: return false;
      }
      return t >= startT && t < startT + a.durationS;
    });
  }
}
