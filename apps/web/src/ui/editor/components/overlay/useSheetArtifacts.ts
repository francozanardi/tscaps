import { useMemo } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useSheetOverlayArtifactsBuilder } from '@ui/editor/contexts/SheetOverlayArtifactsContext';
import type { SegmentPositionsBySheet } from '@presentation/editor/services/SegmentPositionsBySheet';

export interface SheetOverlayArtifacts {
  /** Selector- and keyframe-scoped CSS; stable across frames. */
  cssBySheet: Record<string, string>;
  /** Alignment-independent CSS variables applied on the wrapper: typography and SVG filter URL bindings. Alignment-dependent vars (video-frame layout) are derived per-segment from its effective alignment by `ActiveSegmentLayer`. */
  wrapperVarsBySheet: Record<string, Record<string, string>>;
  /** Position of every segment a sheet owns in document order. */
  segmentPositions: SegmentPositionsBySheet;
  /** Active-segment id → owning sheet. Segments whose sheet was deleted are absent. */
  sheetBySegmentId: Map<string, Sheet>;
  activeSegmentIds: ReadonlySet<string>;
}

/**
 * Derives every time-independent and alignment-independent per-sheet
 * artifact the overlay needs: scoped CSS, base wrapper variables, and
 * the segment-to-sheet routing tables for the segments active at the
 * current frame.
 *
 * Anchor positioning and video-frame offset variables depend on the
 * effective alignment of each individual segment (sheet alignment
 * merged with that segment's override) and are therefore computed in
 * `ActiveSegmentLayer`, not here.
 *
 * The time-varying SVG filter defs and filter URL CSS variables are
 * also NOT in here — those are written directly to the DOM by
 * `SubtitleOverlayController` on each `timechange` so preview ticks
 * don't go through React reconciliation.
 */
export function useSheetArtifacts(
  doc: Document,
  sheets: ReadonlyArray<Sheet>,
  activeSegments: ReadonlyArray<Segment>,
): SheetOverlayArtifacts {
  const builder = useSheetOverlayArtifactsBuilder();
  const cssBySheet = useMemo(
    () => mapSheetsToRecord(sheets, (sheet) => builder.buildScopedCss(sheet)),
    [sheets, builder],
  );
  const wrapperVarsBySheet = useMemo(
    () => mapSheetsToRecord(sheets, (sheet) => builder.buildWrapperVars(sheet)),
    [sheets, builder],
  );
  const segmentPositions = useMemo(
    () => builder.buildSegmentPositions(doc, sheets),
    [doc, sheets, builder],
  );
  const sheetBySegmentId = useMemo(
    () => builder.buildSheetBySegmentId(activeSegments, sheets),
    [activeSegments, sheets, builder],
  );
  const activeSegmentIds = useMemo<ReadonlySet<string>>(() => new Set(sheetBySegmentId.keys()), [sheetBySegmentId]);

  return { cssBySheet, wrapperVarsBySheet, segmentPositions, sheetBySegmentId, activeSegmentIds };
}

function mapSheetsToRecord<T>(sheets: ReadonlyArray<Sheet>, derive: (sheet: Sheet) => T): Record<string, T> {
  const result: Record<string, T> = {};
  for (const sheet of sheets) result[sheet.id] = derive(sheet);
  return result;
}
