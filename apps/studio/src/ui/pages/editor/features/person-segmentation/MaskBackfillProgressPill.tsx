import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { useAnyMaskBackfillPending } from '@ui/pages/editor/features/person-segmentation/hooks/useAnyMaskBackfillPending';

/**
 * Small overlay pill shown over the video preview while any segment is
 * having its actor masks computed on demand. Returns `null` when no
 * backfill is in flight so the surface stays clean the rest of the time.
 */
export function MaskBackfillProgressPill() {
  const pending = useAnyMaskBackfillPending();
  if (!pending) return null;
  return (
    <StatusPill
      label="Preparing effect"
      tone="info"
      active
      className="absolute top-2 left-2 z-10 pointer-events-none"
    />
  );
}
