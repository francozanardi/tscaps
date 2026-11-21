import { MediaBunnyFootageOpener } from '@tscaps/engine/advanced';
import { buildGifOpener } from '@bootstrap/wiring/gifs';
import type { MediaModule } from '@bootstrap/wiring/media';
import { FootageMediaFilePictures } from '@core/media/infrastructure/FootageMediaFilePictures';
import { MediaLooker } from '@core/media/services/MediaLooker';
import type { PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';

// A GIF looked at is decoded no larger than this on its longer side: enough to see it, far less than playing it.
const LOOKED_AT_GIF_MAX_SIDE_PX = 1024;

/**
 * What draws the person's files in the media bin for someone to look at
 * (an assistant, an agent driving the editor): pictures whole, GIFs and
 * videos at chosen moments, in one sheet `composer` lays out.
 */
export function bootMediaLooker(media: MediaModule, composer: PictureSheetComposer): MediaLooker {
  return new MediaLooker(
    media.assets,
    new FootageMediaFilePictures(media.bytes, new MediaBunnyFootageOpener(buildGifOpener(LOOKED_AT_GIF_MAX_SIDE_PX))),
    composer,
  );
}
