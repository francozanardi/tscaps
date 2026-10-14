import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { AnimationStateFingerprint } from '@modules/rendering/subtitle/AnimationStateFingerprint';
import type { SvgFilterStateFingerprint } from '@modules/rendering/subtitle/SvgFilterStateFingerprint';
import type { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import type { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import { AssetGroupBuilder } from '@modules/rendering/subtitle/AssetGroupBuilder';
import type { BatchPlan, RenderItem, AssetGroup, TileAssignment } from '@modules/rendering/subtitle/BatchPlan';
import { profiler } from '@modules/profiling/Profiler';

/** What one timestamp needs painted: the sprite it belongs in, the picture inside it, and what draws it. */
interface PlannedPicture {
  readonly assetKey: string;
  readonly stateKey: string;
  readonly items: RenderItem[];
}

/**
 * Plans one batch: for each timestamp, finds the active prepared
 * styles, groups timestamps by their disjoint kind sets so each
 * rendered sprite carries only the asset payload its tiles need, and
 * deduplicates timestamps that resolve to the same visual state into
 * a single tile inside their group.
 *
 * A batch ends when a group has no room for the picture the next
 * timestamp needs, so the plan covers a prefix of the timestamps it
 * was offered and the caller reads how far it got from the
 * assignments. Offering more than one sheet could ever hold is the
 * point: how much video a sheet covers is then decided by how much
 * the captions move, not by a count fixed before anything was looked
 * at. A still caption can carry a sheet for as long as it stays
 * still.
 */
export class BatchPlanner {

  constructor(
    private readonly doc: Document,
    private readonly styles: Readonly<Record<string, PreparedStyle>>,
    private readonly animationFingerprint: AnimationStateFingerprint,
    private readonly filterFingerprint: SvgFilterStateFingerprint,
    private readonly subtreeDecomposer: SegmentSubtreeDecomposer,
    private readonly layer: CaptionLayer,
  ) {}

  /**
   * Plans as many of `timestamps`, in order, as `maxTiles` distinct
   * pictures can serve. The returned assignments cover a prefix of the
   * input, never fewer than one entry, and the timestamps past it
   * belong to the next batch.
   *
   * The budget is the batch's, not each group's: groups become one
   * sprite sheet each, and it is their total that has to stay inside
   * whatever raster the caller sized `maxTiles` against.
   */
  async plan(timestamps: ReadonlyArray<number>, maxTiles: number): Promise<BatchPlan> {
    const builders = new Map<string, AssetGroupBuilder>();
    const assignments: Array<TileAssignment | null> = [];
    await profiler.time('BatchPlanner.assignTiles', async () => {
      let tilesTaken = 0;
      for (const t of timestamps) {
        const picture = await this.pictureAt(t);
        if (picture === null) {
          assignments.push(null);
          continue;
        }
        const builder = this.builderFor(picture.assetKey, builders);
        const isNewPicture = !builder.holds(picture.stateKey);
        if (isNewPicture && tilesTaken === maxTiles) break;
        if (isNewPicture) tilesTaken++;
        const tile = builder.upsertTile(picture.stateKey, picture.items);
        assignments.push({ assetKey: picture.assetKey, tileIndex: tile.tileIndex });
      }
    });

    const groups = new Map<string, AssetGroup>();
    for (const builder of builders.values()) {
      groups.set(builder.assetKey, builder.build());
    }
    return { groups, assignments };
  }

  /**
   * What this timestamp needs painted — which sprite it belongs in and
   * which picture inside it — or `null` where no Section is active and
   * nothing is painted at all.
   */
  private async pictureAt(t: number): Promise<PlannedPicture | null> {
    const items = profiler.time('BatchPlanner.itemsAt', () => this.itemsAt(t));
    if (items.length === 0) return null;
    return {
      assetKey: this.computeAssetKey(items),
      stateKey: await profiler.time('BatchPlanner.computeStateKey', () => this.computeStateKey(items, t)),
      items,
    };
  }

  private builderFor(assetKey: string, builders: Map<string, AssetGroupBuilder>): AssetGroupBuilder {
    let builder = builders.get(assetKey);
    if (!builder) {
      builder = new AssetGroupBuilder(assetKey);
      builders.set(assetKey, builder);
    }
    return builder;
  }

  private itemsAt(t: number): RenderItem[] {
    const items: RenderItem[] = [];
    for (const section of this.doc.sections) {
      const style = this.styles[section.kind];
      if (!style) continue;
      for (let indexInSection = 0; indexInSection < section.segments.length; indexInSection++) {
        const seg = section.segments[indexInSection]!;
        if (seg.hidden || !seg.time.contains(t)) continue;
        if (!this.paintsInLayer(seg, style)) continue;
        items.push({ seg, style, t, indexInSection });
      }
    }
    items.sort((a, b) => {
      const ds = a.seg.time.start - b.seg.time.start;
      if (ds !== 0) return ds;
      return a.seg.time.end - b.seg.time.end;
    });
    return items;
  }

  private computeAssetKey(items: ReadonlyArray<RenderItem>): string {
    const kinds = new Set<string>();
    for (const it of items) kinds.add(it.style.kind);
    return [...kinds].sort().join(',');
  }

  /**
   * What every active item paints at `t`. Two timestamps sharing this
   * value paint the same picture, so they share a tile.
   *
   * JSON-encoded rather than joined: two of the parts carry text an
   * author writes — a filter body and the name of a `@keyframes` rule
   * — and no separator can be assumed absent from either.
   */
  private async computeStateKey(items: ReadonlyArray<RenderItem>, t: number): Promise<string> {
    const described: string[][] = [];
    for (const item of items) described.push(await this.describeItemState(item, t));
    return JSON.stringify(described);
  }

  /**
   * The item's state in four parts: the state its classes are in,
   * where its animations stand, the filter markup it is painted
   * through, and the timestamp itself where any of them cannot answer
   * for the whole frame — an animation is mid-run, a filter reads a
   * variable this side cannot resolve, or the item paints the video
   * frame, which differs at every timestamp by definition and is
   * invisible from here.
   */
  private async describeItemState({ seg, style, indexInSection }: RenderItem, t: number): Promise<string[]> {
    const filters = this.filterFingerprint.at(style.kind, style.filters, t);
    const classes = this.fingerprintSegmentState(seg, t);
    // An item painting the video frame takes a tile per timestamp
    // whatever its animations do, so they are never described.
    const animations = this.paintsVideoFrame({ seg, style, t, indexInSection })
      ? null
      : await this.animationFingerprint.at(style, seg, t, indexInSection, classes);
    const perFrame = filters === null || animations === null;
    return [
      `${style.kind}:${seg.id}`,
      classes,
      animations ?? '',
      perFrame ? t.toFixed(3) : '',
      filters ?? '',
    ];
  }

  private paintsVideoFrame({ style }: RenderItem): boolean {
    return style.rendering.videoFrame.required;
  }

  /** Whether any subtree of the segment paints in this planner's layer. */
  private paintsInLayer(seg: Segment, style: PreparedStyle): boolean {
    return this.subtreeDecomposer
      .decompose(seg, style.subtreeOverrides, style.decorationPlacements, style.segmentOverrides.get(seg.id))
      .layers.has(this.layer);
  }

  /**
   * Captures every time-varying CSS class the segment subtree
   * exposes (segment, lines, words) so two timestamps that resolve
   * to the same computed style — and therefore the same rendered
   * frame outside active animation windows — share a tile, while two
   * timestamps with different class states stay distinct.
   */
  private fingerprintSegmentState(seg: Segment, t: number): string {
    const segClasses = seg.getCssClasses(t).join(',');
    const lineFingerprints = [...seg.lines].map((line) => this.fingerprintLineState(line, t));
    return `${segClasses}|{${lineFingerprints.join(';')}}`;
  }

  private fingerprintLineState(line: Line, t: number): string {
    const lineClasses = line.getCssClasses(t).join(',');
    const wordClasses = [...line.words].map((w) => w.getCssClasses(t).join(',')).join('|');
    return `${lineClasses}[${wordClasses}]`;
  }
}
