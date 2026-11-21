import { memo } from 'react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { ShotLayerThumbnail } from '@ui/pages/editor/features/shots/components/ShotLayerThumbnail';

interface ShotLayerStackedThumbnailsProps {
  /** The layers' files, in order; null for one whose file was deleted. */
  media: ReadonlyArray<MediaAsset | null>;
}

// Enough to read as a pile; more would only widen the header.
const MAX_SHOWN = 3;

/**
 * Several layers' posters as one small pile, the first on top, each
 * slid along a little so every one shows an edge.
 */
export const ShotLayerStackedThumbnails = memo(function ShotLayerStackedThumbnails({ media }: ShotLayerStackedThumbnailsProps) {
  const shown = media.slice(0, MAX_SHOWN);
  return (
    <span className="shrink-0 flex items-center" aria-hidden>
      {shown.map((file, index) => (
        <span
          key={`${file?.id ?? 'deleted'}:${index}`}
          className={`relative rounded-xs ring-2 ring-surface-1 ${index > 0 ? '-ml-7' : ''}`}
          style={{ zIndex: shown.length - index }}
        >
          <ShotLayerThumbnail media={file} />
        </span>
      ))}
    </span>
  );
});
