import type { AlignmentConfig } from '@tscaps/engine';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';

export interface SegmentOverridesSnapshot {
  readonly style?: Readonly<Record<string, SegmentStyleOverrides>>;
  readonly frozenIds?: ReadonlyArray<string>;
  readonly behindActor?: Readonly<Record<string, BehindActorSegmentOverride>>;
}

const EMPTY_STYLE: SegmentStyleOverrides = {};
const EMPTY_CSS: Readonly<Record<string, string>> = {};

/**
 * Per-segment opt-outs from automatic behavior — style overrides,
 * explicit layout freeze, and the text-behind-actor override. Style
 * and freeze are co-located because the two are coupled: applying a
 * style override implies freezing (reflowing would shift the word
 * boundaries the override keys off of), and resetting a segment must
 * clear both atomically. Splitting them into separate state has
 * historically let them drift apart. The behind-actor override rides
 * along as its own record: it is persisted and undone with the same
 * lifecycle but deliberately does NOT imply freezing and survives a
 * layout reset.
 *
 * Immutable. Every mutator returns a new instance; an empty style
 * record passed to `withStyle` drops the entry so `hasStyleFor`
 * reflects the effective clear.
 */
export class SegmentOverrides {
  static empty(): SegmentOverrides {
    return new SegmentOverrides(new Map(), new Set(), new Map(), new Map());
  }

  static fromSnapshot(snapshot: SegmentOverridesSnapshot): SegmentOverrides {
    const style = new Map<string, SegmentStyleOverrides>(Object.entries(snapshot.style ?? {}));
    const frozen = new Set<string>(snapshot.frozenIds ?? []);
    const behindActor = new Map<string, BehindActorSegmentOverride>(Object.entries(snapshot.behindActor ?? {}));
    return new SegmentOverrides(style, frozen, behindActor, new Map());
  }

  private constructor(
    private readonly _style: ReadonlyMap<string, SegmentStyleOverrides>,
    private readonly _explicitFrozen: ReadonlySet<string>,
    private readonly _behindActor: ReadonlyMap<string, BehindActorSegmentOverride>,
    private readonly _cssCache: Map<string, Readonly<Record<string, string>>>,
  ) {}

  getStyle(segmentId: string): SegmentStyleOverrides {
    return this._style.get(segmentId) ?? EMPTY_STYLE;
  }

  hasStyleFor(segmentId: string): boolean {
    const o = this._style.get(segmentId);
    return o !== undefined && Object.keys(o).length > 0;
  }

  isFrozen(segmentId: string): boolean {
    return this._explicitFrozen.has(segmentId) || this.hasStyleFor(segmentId);
  }

  isEmpty(): boolean {
    return this._style.size === 0 && this._explicitFrozen.size === 0 && this._behindActor.size === 0;
  }

  behindActorOverrideFor(segmentId: string): BehindActorSegmentOverride {
    return this._behindActor.get(segmentId) ?? 'auto';
  }

  behindActorOverrides(): ReadonlyMap<string, BehindActorSegmentOverride> {
    return this._behindActor;
  }

  withStyle(segmentId: string, overrides: SegmentStyleOverrides): SegmentOverrides {
    const nextStyle = new Map(this._style);
    if (Object.keys(overrides).length === 0) nextStyle.delete(segmentId);
    else nextStyle.set(segmentId, overrides);
    const nextCache = new Map(this._cssCache);
    nextCache.delete(segmentId);
    return new SegmentOverrides(nextStyle, this._explicitFrozen, this._behindActor, nextCache);
  }

  withFreeze(segmentId: string): SegmentOverrides {
    if (this._explicitFrozen.has(segmentId)) return this;
    const next = new Set(this._explicitFrozen);
    next.add(segmentId);
    return new SegmentOverrides(this._style, next, this._behindActor, this._cssCache);
  }

  withFreezeMany(segmentIds: Iterable<string>): SegmentOverrides {
    const next = new Set(this._explicitFrozen);
    let changed = false;
    for (const id of segmentIds) {
      if (!next.has(id)) { next.add(id); changed = true; }
    }
    return changed ? new SegmentOverrides(this._style, next, this._behindActor, this._cssCache) : this;
  }

  /** `'auto'` clears the entry — absence and `'auto'` are the same state. */
  withBehindActorOverride(segmentId: string, override: BehindActorSegmentOverride): SegmentOverrides {
    if (this.behindActorOverrideFor(segmentId) === override) return this;
    const next = new Map(this._behindActor);
    if (override === 'auto') next.delete(segmentId);
    else next.set(segmentId, override);
    return new SegmentOverrides(this._style, this._explicitFrozen, next, this._cssCache);
  }

  resetSegment(segmentId: string): SegmentOverrides {
    return this.resetSegments([segmentId]);
  }

  /**
   * Drops every behind-actor override that targets one of `segmentIds`.
   * Style and freeze state pass through unchanged.
   */
  clearBehindActorFor(segmentIds: Iterable<string>): SegmentOverrides {
    let next: Map<string, BehindActorSegmentOverride> | null = null;
    for (const id of segmentIds) {
      if (!this._behindActor.has(id)) continue;
      next ??= new Map(this._behindActor);
      next.delete(id);
    }
    if (!next) return this;
    return new SegmentOverrides(this._style, this._explicitFrozen, next, this._cssCache);
  }

  resetSegments(segmentIds: Iterable<string>): SegmentOverrides {
    let nextStyle: Map<string, SegmentStyleOverrides> | null = null;
    let nextFrozen: Set<string> | null = null;
    const nextCache = new Map(this._cssCache);
    for (const id of segmentIds) {
      if (this._style.has(id)) {
        nextStyle ??= new Map(this._style);
        nextStyle.delete(id);
      }
      if (this._explicitFrozen.has(id)) {
        nextFrozen ??= new Set(this._explicitFrozen);
        nextFrozen.delete(id);
      }
      nextCache.delete(id);
    }
    if (!nextStyle && !nextFrozen) return this;
    return new SegmentOverrides(
      nextStyle ?? this._style,
      nextFrozen ?? this._explicitFrozen,
      this._behindActor,
      nextCache,
    );
  }

  /**
   * Declaration map of typography and color overrides for one segment,
   * ready to concatenate onto the wrapper's `style` attribute after
   * the sheet-derived inline styles. Every entry is a `--tscaps-*`
   * custom-property assignment — descendants read them via `var(...)`,
   * so the wrapper override beats the template's class-rule
   * specificity.
   *
   * Position offsets are NOT emitted here — they don't belong on the
   * wrapper (which is `display: inline-block` without positioning
   * context). `buildAlignmentOverride` returns them as a structured
   * `Partial<AlignmentConfig>` for the anchor to consume.
   *
   * Memoised per segment so unchanged segments keep a stable reference
   * across renders.
   */
  buildInlineStyles(segmentId: string): Readonly<Record<string, string>> {
    const cached = this._cssCache.get(segmentId);
    if (cached !== undefined) return cached;
    const o = this._style.get(segmentId);
    if (!o) {
      this._cssCache.set(segmentId, EMPTY_CSS);
      return EMPTY_CSS;
    }
    const css: Record<string, string> = {};
    if (o.fontWeight !== undefined) css[TemplateCssVariable.FONT_WEIGHT] = String(o.fontWeight);
    if (o.italic !== undefined) css[TemplateCssVariable.FONT_STYLE] = o.italic ? 'italic' : 'normal';
    if (o.underline !== undefined || o.strikethrough !== undefined) {
      const parts: string[] = [];
      if (o.underline) parts.push('underline');
      if (o.strikethrough) parts.push('line-through');
      css[TemplateCssVariable.TEXT_DECORATION] = parts.length > 0 ? parts.join(' ') : 'none';
    }
    if (o.fontFamily !== undefined) css[TemplateCssVariable.FONT_FAMILY] = `'${o.fontFamily}'`;
    if (o.fontSize !== undefined) css[TemplateCssVariable.FONT_SIZE] = `${o.fontSize}cqh`;
    if (o.color !== undefined) css[TemplateCssVariable.PRIMARY_COLOR] = o.color;
    if (o.rotation !== undefined) css[TemplateCssVariable.ROTATION] = `${o.rotation}deg`;
    this._cssCache.set(segmentId, css);
    return css;
  }

  /**
   * Partial alignment override for one segment — only the fields the
   * user has explicitly moved. Merged over the sheet's
   * `AlignmentConfig` by consumers (preview anchor, engine renderer)
   * to derive the segment's effective anchor point. Returns
   * `undefined` when the segment has no positional override.
   */
  buildAlignmentOverride(segmentId: string): Partial<AlignmentConfig> | undefined {
    const o = this._style.get(segmentId);
    if (!o) return undefined;
    const out: Partial<AlignmentConfig> = {};
    if (o.verticalOffset !== undefined) out.verticalOffset = o.verticalOffset;
    if (o.horizontalOffset !== undefined) out.horizontalOffset = o.horizontalOffset;
    return Object.keys(out).length > 0 ? out : undefined;
  }

  toSnapshot(): SegmentOverridesSnapshot {
    const style: Record<string, SegmentStyleOverrides> = {};
    for (const [k, v] of this._style) style[k] = v;
    const behindActor: Record<string, BehindActorSegmentOverride> = {};
    for (const [k, v] of this._behindActor) behindActor[k] = v;
    return {
      ...(this._style.size > 0 ? { style } : {}),
      ...(this._explicitFrozen.size > 0 ? { frozenIds: [...this._explicitFrozen] } : {}),
      ...(this._behindActor.size > 0 ? { behindActor } : {}),
    };
  }
}
