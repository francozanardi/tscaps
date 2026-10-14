import type { Document, TopLayerSource } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';

/**
 * Snapshot of the render inputs a contributor may consult while
 * preparing its contribution. `document` is the cut-aware render
 * document — segment times are in the output timeline.
 */
export interface ExportRenderContext {
  readonly document: Document;
  readonly sheets: Sheet[];
  readonly behindActorOverrides: BehindActorOverrideRegistry;
  readonly projectId: string | null;
}

/**
 * What a contributor adds to the render. `segmentClasses` are extra
 * classes appended to each segment element's class list, keyed by
 * segment id; `topLayer` is an optional layer painted above the
 * captions; `elementsUnderTopLayer` are words and glyphs painted under
 * that layer while the rest of their caption paints over it. All may be
 * empty when the contributor has nothing to add for this export.
 */
export interface ExportRenderContribution {
  readonly segmentClasses: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly topLayer: TopLayerSource | null;
  readonly elementsUnderTopLayer: ReadonlySet<string>;
}

/**
 * A feature that augments the export render without the export flow
 * knowing the feature exists. `prepare` runs once per export before
 * rendering starts and may perform async work (cache loads,
 * precomputation); the returned contribution is consumed through the
 * generic channels only. At most one contributor per export may
 * return a `topLayer`.
 */
export interface ExportRenderContributor {
  prepare(context: ExportRenderContext): Promise<ExportRenderContribution>;
}
