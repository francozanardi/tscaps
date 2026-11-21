import { memo } from 'react';
import { Captions, Type } from 'lucide-react';
import type { InspectedCaptionElement } from '@ui/pages/editor/features/element/useInspectedElement';
import { InspectedElementThumbnailBox } from '@ui/pages/editor/features/element/InspectedElementThumbnailBox';

interface CaptionElementThumbnailProps {
  element: InspectedCaptionElement;
}

const ICON_SIZE = 18;

/**
 * A caption element's picture: an emoji is its own glyph, a word and a
 * scene, which are text the name beside it already quotes, the icon of
 * what they are.
 */
export const CaptionElementThumbnail = memo(function CaptionElementThumbnail({ element }: CaptionElementThumbnailProps) {
  return (
    <InspectedElementThumbnailBox>
      {element.kind === 'decoration'
        ? <span className="text-xl leading-none">{element.name}</span>
        : element.kind === 'word'
          ? <Type size={ICON_SIZE} />
          : <Captions size={ICON_SIZE} />}
    </InspectedElementThumbnailBox>
  );
});
