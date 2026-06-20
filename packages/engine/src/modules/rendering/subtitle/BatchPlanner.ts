import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { AnimationProbe } from '@modules/rendering/subtitle/AnimationProbe';
import { AssetGroupBuilder } from '@modules/rendering/subtitle/AssetGroupBuilder';
import type { BatchPlan, RenderItem, AssetGroup, TileAssignment } from '@modules/rendering/subtitle/BatchPlan';

/**
 * Plans one batch: for each timestamp, finds the active prepared
 * styles, groups timestamps by their disjoint kind sets so each
 * rendered sprite carries only the asset payload its tiles need, and
 * deduplicates timestamps that resolve to the same visual state into
 * a single tile inside their group.
 */
export class BatchPlanner {

  constructor(
    private readonly doc: Document,
    private readonly styles: Readonly<Record<string, PreparedStyle>>,
    private readonly animationProbe: AnimationProbe,
  ) {}

  plan(timestamps: ReadonlyArray<number>): BatchPlan {
    const builders = new Map<string, AssetGroupBuilder>();

    const assignments = timestamps.map((t): TileAssignment | null => {
      const items = this.itemsAt(t);
      if (items.length === 0) return null;

      const assetKey = this.computeAssetKey(items);
      let builder = builders.get(assetKey);
      if (!builder) {
        builder = new AssetGroupBuilder(assetKey);
        builders.set(assetKey, builder);
      }

      const stateKey = this.computeStateKey(items, t);
      const tile = builder.upsertTile(stateKey, items);
      return { assetKey, tileIndex: tile.tileIndex };
    });

    const groups = new Map<string, AssetGroup>();
    for (const builder of builders.values()) {
      groups.set(builder.assetKey, builder.build());
    }
    return { groups, assignments };
  }

  private itemsAt(t: number): RenderItem[] {
    const items: RenderItem[] = [];
    for (const seg of this.doc.getActiveSegments(t)) {
      const style = this.styles[seg.getSection().kind];
      if (style) items.push({ seg, style, t });
    }
    return items;
  }

  private computeAssetKey(items: ReadonlyArray<RenderItem>): string {
    const kinds = new Set<string>();
    for (const it of items) kinds.add(it.style.kind);
    return [...kinds].sort().join(',');
  }

  private computeStateKey(items: ReadonlyArray<RenderItem>, t: number): string {
    return items.map(({ seg, style }) => {
      const base = `${style.kind}:${seg.id}:${this.fingerprintSegmentState(seg, t)}`;
      return this.animationProbe.isItemAnimating(style, seg, t) ? `${base}:${t.toFixed(3)}` : base;
    }).join('|');
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
