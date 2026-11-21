import { memo } from 'react';
import { FileX, Shapes } from 'lucide-react';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MEDIA_ASSET_TYPE_ICONS } from '@ui/pages/editor/features/media/mediaAssetTypeIcons';
import { useShotLayerPoster } from '@ui/pages/editor/features/shots/hooks/useShotLayerPoster';
import { InspectedElementThumbnailBox } from '@ui/pages/editor/features/element/InspectedElementThumbnailBox';

interface ShotLayerThumbnailProps {
  /** The layer's file, or null when it was deleted or the layer is a graphic. */
  media: MediaAsset | null;
  /** Whether the layer is a graphic, which has no file and shows the graphic mark. False by default. */
  isGraphic?: boolean | undefined;
}

const ICON_SIZE = 18;

/**
 * A small square of the layer's file, the poster the media bin shows
 * for it: a video's opening frame, a picture, a GIF's first frame. Its
 * type's icon until the poster is made, and a crossed-out file once the
 * file is gone. A graphic shows the graphic mark.
 */
export const ShotLayerThumbnail = memo(function ShotLayerThumbnail({ media, isGraphic = false }: ShotLayerThumbnailProps) {
  if (isGraphic) {
    return (
      <InspectedElementThumbnailBox>
        <Shapes size={ICON_SIZE} />
      </InspectedElementThumbnailBox>
    );
  }
  if (media === null) {
    return (
      <InspectedElementThumbnailBox>
        <FileX size={ICON_SIZE} />
      </InspectedElementThumbnailBox>
    );
  }
  return <ShotLayerPoster media={media} />;
});

function ShotLayerPoster({ media }: { media: MediaAsset }) {
  const poster = useShotLayerPoster(media);
  const TypeIcon = MEDIA_ASSET_TYPE_ICONS[media.type];
  return (
    <InspectedElementThumbnailBox>
      {poster
        ? <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        : <TypeIcon size={ICON_SIZE} />}
    </InspectedElementThumbnailBox>
  );
}
