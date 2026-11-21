import { memo } from 'react';
import { Clapperboard } from 'lucide-react';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { InspectedElementThumbnailBox } from '@ui/pages/editor/features/element/InspectedElementThumbnailBox';
import { useShotPoster } from '@ui/pages/editor/features/shots/hooks/useShotPoster';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';

interface ShotThumbnailProps {
  /** Where the shot starts, in source time. */
  startSec: number;
}

// The shot's frame is taken a moment in, past whatever a cut leaves on its first frame.
const POSTER_LEAD_SEC = 0.1;

/**
 * A small square of the frame the shot's own video opens on — the
 * video's, not a b-roll's, since what is edited is what its camera does
 * with that video. The shot's icon until the frame is taken.
 */
export const ShotThumbnail = memo(function ShotThumbnail({ startSec }: ShotThumbnailProps) {
  const { video } = useEditorState();
  const sampler = useVideoFrameSampler();
  const poster = useShotPoster(sampler, video.preview?.file ?? video.file, startSec + POSTER_LEAD_SEC);
  return (
    <InspectedElementThumbnailBox>
      {poster
        ? <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        : <Clapperboard size={18} />}
    </InspectedElementThumbnailBox>
  );
});
