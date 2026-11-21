import type { AudioDuck, AudioLayer } from '@modules/video/AudioLayer';
import type { TimeRange } from '@modules/video/RenderTimeMap';

/** One corner of a piecewise-linear gain curve. */
export interface AudioGainBreakpoint {
  readonly timeSec: number;
  /** Linear. */
  readonly gain: number;
}

/** What of a layer shapes its gain: everything but the sound it plays. */
export type AudioGainShape = Omit<AudioLayer, 'id' | 'source'>;

/** What a layer's stretch depends on beyond the layer itself. */
export interface AudioGainEnvelopeBounds {
  /** Length of the output; the layer stops there at the latest. */
  readonly outputDurationSec: number;
  /** Length of the layer's source; a layer that plays once stops where it runs out. */
  readonly sourceDurationSec: number;
}

/**
 * A layer's gain over output time: its own gain, shaped by its fades
 * and its duck, as the corners of a piecewise-linear curve.
 *
 * The curve moves in a straight line from one breakpoint to the next,
 * so scheduling each breakpoint as a linear ramp on a Web Audio gain
 * parameter, the first one set outright, reproduces it exactly. Two
 * breakpoints at one time are a step: the first is the value just
 * before it, the second the value from it on. The layer is silent
 * outside `[startSec, endSec)`.
 *
 * Where a fade and a duck ramp overlap, their product is curved; the
 * curve there is approximated by a few straight pieces, and those
 * pieces are the envelope's definition, not an approximation of it.
 *
 * The fade in starts at the layer's start and the fade out lands on its
 * end. When the two together are longer than the stretch, both shrink
 * in proportion so they meet.
 */
export class AudioGainEnvelope {

  /** Straight pieces standing for a stretch where a fade and a duck ramp at once. */
  private static readonly OVERLAP_PIECES = 8;

  readonly startSec: number;
  /** Where the layer stops sounding; equal to `startSec` when it never sounds. */
  readonly endSec: number;
  /** Ordered by time; empty when the layer never sounds. */
  readonly breakpoints: ReadonlyArray<AudioGainBreakpoint>;

  /**
   * The gain of an input's own audio: `gain` over the whole output,
   * lowered by each of `ducks` where it has ranges, their gains
   * multiplied where they overlap. It never fades, and it lasts as long
   * as the output, open-ended when that is not known.
   */
  static forInput(gain: number, ducks: ReadonlyArray<AudioDuck>, outputDurationSec: number): AudioGainEnvelope {
    const shape: AudioGainShape = {
      outputStartSec: 0,
      outputEndSec: Number.POSITIVE_INFINITY,
      sourceStartSec: 0,
      sourcePassSec: Number.POSITIVE_INFINITY,
      gain,
      fadeInSec: 0,
      fadeOutSec: 0,
      duck: null,
    };
    return new AudioGainEnvelope(shape, { outputDurationSec, sourceDurationSec: Number.POSITIVE_INFINITY }, ducks);
  }

  /** `alsoLoweredBy` lowers the layer on top of its own duck, each one's gain multiplied in. */
  constructor(layer: AudioGainShape, bounds: AudioGainEnvelopeBounds, alsoLoweredBy: ReadonlyArray<AudioDuck> = []) {
    this.startSec = layer.outputStartSec;
    this.endSec = Math.max(this.startSec, this.endOf(layer, bounds));
    this.breakpoints = this.endSec > this.startSec ? this.curveOf(layer, alsoLoweredBy) : [];
  }

  /** The gain at `outputSec`; 0 outside the layer's stretch. */
  gainAt(outputSec: number): number {
    if (outputSec < this.startSec || outputSec >= this.endSec) return 0;
    return this.valueFrom(this.breakpoints, outputSec);
  }

  /**
   * Fills `target` with the gain at successive frames, frame `i` being
   * at `(firstFrame + i) / sampleRate` seconds of output. Frames outside
   * the layer's stretch take the value at its nearer edge, so a frame
   * rounded onto the stretch's first or last sample keeps the gain the
   * stretch has there.
   */
  sampleInto(target: Float32Array, firstFrame: number, sampleRate: number): void {
    const points = this.breakpoints;
    if (points.length === 0) {
      target.fill(0);
      return;
    }
    let segment = 0;
    for (let i = 0; i < target.length; i++) {
      const timeSec = Math.min(Math.max((firstFrame + i) / sampleRate, this.startSec), this.endSec);
      while (segment < points.length - 1 && points[segment + 1]!.timeSec <= timeSec) segment++;
      target[i] = timeSec >= this.endSec ? points[points.length - 1]!.gain : this.interpolate(points, segment, timeSec);
    }
  }

  private endOf(layer: AudioGainShape, bounds: AudioGainEnvelopeBounds): number {
    const end = Math.min(layer.outputEndSec, bounds.outputDurationSec);
    const startsOver = Number.isFinite(layer.sourcePassSec) && layer.sourcePassSec > 0;
    if (startsOver) return end;
    const playable = Math.max(0, bounds.sourceDurationSec - layer.sourceStartSec);
    return Math.min(end, layer.outputStartSec + playable);
  }

  private curveOf(layer: AudioGainShape, alsoLoweredBy: ReadonlyArray<AudioDuck>): AudioGainBreakpoint[] {
    const ducks = [...(layer.duck ? [layer.duck] : []), ...alsoLoweredBy];
    const product = ducks.reduce(
      (curve, duck) => this.productOver(curve, this.duckCurve(duck.ranges, duck.gain, duck.attackSec, duck.releaseSec)),
      this.fadeCurve(layer),
    );
    return product.map((point) => ({ timeSec: point.timeSec, gain: point.gain * layer.gain }));
  }

  private fadeCurve(layer: AudioGainShape): AudioGainBreakpoint[] {
    const length = this.endSec - this.startSec;
    let fadeIn = Math.max(0, layer.fadeInSec);
    let fadeOut = Math.max(0, layer.fadeOutSec);
    if (fadeIn + fadeOut > length) {
      const scale = length / (fadeIn + fadeOut);
      fadeIn *= scale;
      fadeOut *= scale;
    }
    const points: AudioGainBreakpoint[] = [{ timeSec: this.startSec, gain: fadeIn > 0 ? 0 : 1 }];
    if (fadeIn > 0) points.push({ timeSec: this.startSec + fadeIn, gain: 1 });
    if (fadeOut > 0) points.push({ timeSec: this.endSec - fadeOut, gain: 1 });
    points.push({ timeSec: this.endSec, gain: fadeOut > 0 ? 0 : 1 });
    return points;
  }

  /** The duck's multiplier over all time: 1 away from the ranges. */
  private duckCurve(
    ranges: ReadonlyArray<TimeRange>,
    gain: number,
    attackSec: number,
    releaseSec: number,
  ): AudioGainBreakpoint[] {
    const attack = Math.max(0, attackSec);
    const release = Math.max(0, releaseSec);
    const points: AudioGainBreakpoint[] = [];
    for (const range of this.mergedRanges(ranges, attack + release)) {
      points.push({ timeSec: range.startSec - attack, gain: 1 });
      points.push({ timeSec: range.startSec, gain });
      points.push({ timeSec: range.endSec, gain });
      points.push({ timeSec: range.endSec + release, gain: 1 });
    }
    return points;
  }

  /** Sorted, non-empty ranges, with those closer than `joinGapSec` joined. */
  private mergedRanges(ranges: ReadonlyArray<TimeRange>, joinGapSec: number): TimeRange[] {
    const sorted = ranges.filter((range) => range.endSec > range.startSec).sort((a, b) => a.startSec - b.startSec);
    const merged: TimeRange[] = [];
    for (const range of sorted) {
      const last = merged[merged.length - 1];
      if (last && range.startSec - last.endSec <= joinGapSec) {
        merged[merged.length - 1] = { startSec: last.startSec, endSec: Math.max(last.endSec, range.endSec) };
      } else {
        merged.push(range);
      }
    }
    return merged;
  }

  /** The product of two curves over the layer's stretch. An empty curve is 1 everywhere. */
  private productOver(first: AudioGainBreakpoint[], second: AudioGainBreakpoint[]): AudioGainBreakpoint[] {
    const times = this.cornerTimes(first, second);
    const points: AudioGainBreakpoint[] = [];
    for (const [index, timeSec] of times.entries()) {
      const before = this.valueUntil(first, timeSec) * this.valueUntil(second, timeSec);
      const after = this.valueFrom(first, timeSec) * this.valueFrom(second, timeSec);
      if (index > 0) points.push({ timeSec, gain: before });
      if (index === times.length - 1) break;
      if (index === 0 || after !== before) points.push({ timeSec, gain: after });
      points.push(...this.overlapPieces(first, second, timeSec, times[index + 1]!));
    }
    return points;
  }

  private cornerTimes(first: AudioGainBreakpoint[], second: AudioGainBreakpoint[]): number[] {
    const inside = [...first, ...second]
      .map((point) => point.timeSec)
      .filter((timeSec) => timeSec > this.startSec && timeSec < this.endSec);
    return [...new Set([this.startSec, ...inside, this.endSec])].sort((a, b) => a - b);
  }

  /** Interior points of `(fromSec, toSec)` where both curves ramp, and their product bends. */
  private overlapPieces(
    first: AudioGainBreakpoint[],
    second: AudioGainBreakpoint[],
    fromSec: number,
    toSec: number,
  ): AudioGainBreakpoint[] {
    if (!this.ramps(first, fromSec, toSec) || !this.ramps(second, fromSec, toSec)) return [];
    const pieces: AudioGainBreakpoint[] = [];
    const count = AudioGainEnvelope.OVERLAP_PIECES;
    for (let step = 1; step < count; step++) {
      const timeSec = fromSec + ((toSec - fromSec) * step) / count;
      pieces.push({ timeSec, gain: this.valueFrom(first, timeSec) * this.valueFrom(second, timeSec) });
    }
    return pieces;
  }

  private ramps(points: AudioGainBreakpoint[], fromSec: number, toSec: number): boolean {
    return this.valueFrom(points, fromSec) !== this.valueUntil(points, toSec);
  }

  /** The curve's value from `timeSec` on: after a step there, the value it steps to. */
  private valueFrom(points: ReadonlyArray<AudioGainBreakpoint>, timeSec: number): number {
    if (points.length === 0) return 1;
    let segment = -1;
    while (segment < points.length - 1 && points[segment + 1]!.timeSec <= timeSec) segment++;
    if (segment < 0) return points[0]!.gain;
    return this.interpolate(points, segment, timeSec);
  }

  /** The curve's value just up to `timeSec`: before a step there, the value it steps from. */
  private valueUntil(points: ReadonlyArray<AudioGainBreakpoint>, timeSec: number): number {
    if (points.length === 0) return 1;
    const next = points.findIndex((point) => point.timeSec >= timeSec);
    if (next < 0) return points[points.length - 1]!.gain;
    if (next === 0) return points[0]!.gain;
    return this.interpolate(points, next - 1, timeSec);
  }

  /** The value at `timeSec` on the line from `points[segment]` to the point after it. */
  private interpolate(points: ReadonlyArray<AudioGainBreakpoint>, segment: number, timeSec: number): number {
    const from = points[segment]!;
    const to = points[segment + 1];
    // A curve open to the end holds its last value there: no line reaches infinity.
    if (!to || to.timeSec <= from.timeSec || !Number.isFinite(to.timeSec)) return from.gain;
    const progress = (timeSec - from.timeSec) / (to.timeSec - from.timeSec);
    return from.gain + (to.gain - from.gain) * progress;
  }
}
