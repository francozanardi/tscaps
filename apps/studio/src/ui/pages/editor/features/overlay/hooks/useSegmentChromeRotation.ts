import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

/**
 * The angle, in degrees, a segment's chrome is drawn at: the live angle
 * while the segment is being rotated, else the segment's own field, else
 * its sheet's. Always 0 for a template that does not rotate segments.
 */
export function useSegmentChromeRotation(segmentId: string, sheet: Sheet, elementStyles: ElementStyles): number {
  const dragState = useOverlayDragState();
  if (!sheet.template.features.rotation.segment) return 0;
  const liveRotationDeg = dragState?.kind === 'segment-rotate' && dragState.segmentId === segmentId
    ? dragState.rotationDeg
    : null;
  return liveRotationDeg ?? elementStyles.fieldNumber(segmentId, ElementFieldId.ROTATION) ?? sheet.rotationConfig.angleDeg;
}
