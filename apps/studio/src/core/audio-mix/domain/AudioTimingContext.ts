import type { Document, RenderTimeMap } from '@tscaps/engine';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * The edit anchors are read against. Treat an instance as immutable:
 * what is read off it is remembered for as long as it lives, so a
 * changed edit is a new context.
 */
export interface AudioTimingContext {
  /** The Original track's document, whatever caption track is active. */
  readonly originalDocument: Document | null;
  /** The sheets the Original track's sections route to: with its emoji edits, they decide which of its emojis show. */
  readonly originalSheets: ReadonlyArray<Sheet>;
  /** The Original track's emoji edits. */
  readonly originalDecorationOverrides: DecorationOverrideRegistry;
  readonly shots: ShotPartition;
  /** The files shot layers name, which say how long a b-roll runs. */
  readonly media: MediaAssetCatalog;
  /** Built from the cuts. */
  readonly timeMap: RenderTimeMap;
  /** The source video's length, in seconds; 0 where it is not known yet. */
  readonly videoDurationSec: number;
}
