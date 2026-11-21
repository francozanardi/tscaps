import { useMemo } from 'react';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { OriginalCaptions } from '@core/translations/services/OriginalCaptionTrackReader';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/**
 * The edit sounds are placed against: the Original track's words and
 * which of its emojis show, the shots, the files their layers show and
 * the cuts. A new object only when one of them changes, since what is
 * read off it is remembered for as long as it lives; `original` itself
 * may be a new object on every render.
 */
export function useAudioTimingContext(
  original: OriginalCaptions,
  shots: ShotPartition,
  videoDurationSec: number,
): AudioTimingContext {
  const media = useMediaAssets();
  const timeMap = useRenderTimeMap();
  const { document, sheets, decorationOverrides } = original;
  return useMemo(
    () => ({
      originalDocument: document,
      originalSheets: sheets,
      originalDecorationOverrides: decorationOverrides,
      shots,
      media,
      timeMap,
      videoDurationSec,
    }),
    [document, sheets, decorationOverrides, shots, media, timeMap, videoDurationSec],
  );
}
