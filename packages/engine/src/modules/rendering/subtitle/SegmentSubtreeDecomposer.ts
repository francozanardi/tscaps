import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import type { Decoration } from '@modules/document/Decoration';
import type { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import type { ScopedRenderOverride } from '@modules/rendering/types/ScopedRenderOverride';
import type { DecorationPlacementSide } from '@modules/rendering/types/DecorationPlacementSide';
import { CaptionStacking } from '@modules/rendering/types/CaptionStacking';
import { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';

/** A word the segment subtree pulls out of line flow because its id carries an alignment override. */
export interface PositionedSubtreeWord {
  readonly word: Word;
  readonly line: Line;
  readonly indexInLine: number;
}

/** A decoration the segment subtree pulls out of line flow because its id carries an alignment override. */
export interface PositionedSubtreeDecoration {
  readonly word: Word;
  readonly line: Line;
  readonly indexInLine: number;
  readonly decoration: Decoration;
}

/** Elements of the main subtree painted together by one copy of it, because they paint in the same layer. */
export interface IsolatedSubtreeGroup {
  readonly keptIds: ReadonlySet<string>;
  /** The layer the copy paints in. Never the segment's own: an element isolated into that one stays in the main subtree. */
  readonly layer: CaptionLayer;
}

/**
 * The breakdown of a segment into the subtrees a consumer needs to
 * render: the words that move to their own anchor, the decorations
 * that move to their own anchor, the set of word ids the main subtree
 * skips, and whether every word in the segment has been positioned
 * (in which case the main subtree is skipped entirely so its
 * background chrome doesn't paint as an empty shell).
 *
 * Isolation: the copies the main subtree needs (`isolatedGroups`) and
 * every element they paint (`isolatedIds`, which the main subtree
 * hides).
 *
 * Layers: the main subtree paints in the segment's layer
 * (`segmentLayer`), each copy in its group's, an element at its own
 * anchor in the one its own override and its segment's resolve to, and
 * `layers` holds every layer the segment paints anything in.
 */
export interface SegmentSubtreeDecomposition {
  readonly positionedWords: ReadonlyArray<PositionedSubtreeWord>;
  readonly positionedDecorations: ReadonlyArray<PositionedSubtreeDecoration>;
  readonly excludedWordIds: ReadonlySet<string>;
  readonly everyWordIsPositioned: boolean;
  readonly isolatedGroups: ReadonlyArray<IsolatedSubtreeGroup>;
  readonly isolatedIds: ReadonlySet<string>;
  readonly segmentLayer: CaptionLayer;
  readonly layers: ReadonlySet<CaptionLayer>;
}

/**
 * Pure policy: given the segment and its style's word-level alignment
 * overrides, decides which words and decorations leave the main flow
 * and what the main subtree must skip, and which of the elements left
 * in it are painted by isolated copies. Stateless, DOM-free, side-
 * effect free.
 *
 * Only an element still inside the main subtree needs a copy: one at
 * its own anchor already has a subtree of its own to isolate, and so
 * does a glyph painted inside a word that moved to its own anchor.
 */
export class SegmentSubtreeDecomposer {

  decompose(
    segment: Segment,
    subtreeOverrides: ElementRenderOverrides,
    decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>,
    segmentOverride: ScopedRenderOverride | undefined,
  ): SegmentSubtreeDecomposition {
    const positionedWords = this.collectPositionedWords(segment, subtreeOverrides);
    const positionedDecorations = this.collectPositionedDecorations(segment, subtreeOverrides);
    const excludedWordIds = new Set(positionedWords.map((p) => p.word.id));
    const everyWordIsPositioned = this.allWordsExcluded(segment, excludedWordIds);
    const segmentLayer = this.segmentLayerOf(segmentOverride);
    const isolatedGroups = this.collectIsolatedGroups(segment, subtreeOverrides, decorationPlacements, excludedWordIds, segmentLayer);
    const isolatedIds = new Set(isolatedGroups.flatMap((group) => [...group.keptIds]));
    return {
      positionedWords,
      positionedDecorations,
      excludedWordIds,
      everyWordIsPositioned,
      isolatedGroups,
      isolatedIds,
      segmentLayer,
      layers: new Set([
        ...(everyWordIsPositioned ? [] : [segmentLayer]),
        ...isolatedGroups.map((group) => group.layer),
        ...positionedWords.map(({ word }) => this.elementLayerOf(word.id, subtreeOverrides, segmentLayer)),
        ...positionedDecorations.map(({ decoration }) => this.elementLayerOf(decoration.id, subtreeOverrides, segmentLayer)),
      ]),
    };
  }

  /** The layer the segment's main subtree paints in, which is also what its elements fall back to. */
  segmentLayerOf(segmentOverride: ScopedRenderOverride | undefined): CaptionLayer {
    return CaptionLayer.of(
      segmentOverride?.stacking ?? CaptionStacking.UNDER_TOP_LAYER,
      segmentOverride?.blendMode ?? CaptionBlendMode.NORMAL,
    );
  }

  /**
   * The layer an element of the segment paints in: what its override
   * names, and the segment's for whatever it leaves out. This is the
   * layer of the subtree of an element at its own anchor, too.
   */
  elementLayerOf(elementId: string, subtreeOverrides: ElementRenderOverrides, segmentLayer: CaptionLayer): CaptionLayer {
    const override = subtreeOverrides.get(elementId);
    return CaptionLayer.of(override?.stacking ?? segmentLayer.stacking, override?.blendMode ?? segmentLayer.blendMode);
  }

  private collectIsolatedGroups(
    segment: Segment,
    subtreeOverrides: ElementRenderOverrides,
    decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>,
    excludedWordIds: ReadonlySet<string>,
    segmentLayer: CaptionLayer,
  ): IsolatedSubtreeGroup[] {
    const groups = new Map<CaptionLayer, Set<string>>();
    const keep = (elementId: string): void => {
      const layer = this.elementLayerOf(elementId, subtreeOverrides, segmentLayer);
      if (layer === segmentLayer) return;
      // Elements in the same layer share a copy: the copy count is
      // bounded by how many layers a segment paints in, not by how many
      // elements are isolated.
      let keptIds = groups.get(layer);
      if (!keptIds) {
        keptIds = new Set();
        groups.set(layer, keptIds);
      }
      keptIds.add(elementId);
    };
    for (const line of segment.lines) {
      for (const word of line.words) {
        const wordInMainSubtree = !excludedWordIds.has(word.id);
        if (wordInMainSubtree) keep(word.id);
        const decoration = word.decoration;
        if (!decoration || subtreeOverrides.get(decoration.id)?.alignment) continue;
        const paintsInsideWord = !decorationPlacements.has(decoration.id);
        if (wordInMainSubtree || !paintsInsideWord) keep(decoration.id);
      }
    }
    return [...groups].map(([layer, keptIds]) => ({ layer, keptIds }));
  }

  private collectPositionedWords(segment: Segment, subtreeOverrides: ElementRenderOverrides): PositionedSubtreeWord[] {
    const out: PositionedSubtreeWord[] = [];
    for (const line of segment.lines) {
      for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
        const word = line.words[indexInLine]!;
        if (subtreeOverrides.get(word.id)?.alignment) out.push({ word, line, indexInLine });
      }
    }
    return out;
  }

  private collectPositionedDecorations(segment: Segment, subtreeOverrides: ElementRenderOverrides): PositionedSubtreeDecoration[] {
    const out: PositionedSubtreeDecoration[] = [];
    for (const line of segment.lines) {
      for (let indexInLine = 0; indexInLine < line.words.length; indexInLine++) {
        const word = line.words[indexInLine]!;
        const decoration = word.decoration;
        if (!decoration) continue;
        if (subtreeOverrides.get(decoration.id)?.alignment) out.push({ word, line, indexInLine, decoration });
      }
    }
    return out;
  }

  private allWordsExcluded(segment: Segment, excludedWordIds: ReadonlySet<string>): boolean {
    for (const line of segment.lines) {
      for (const word of line.words) {
        if (!excludedWordIds.has(word.id)) return false;
      }
    }
    return true;
  }
}
