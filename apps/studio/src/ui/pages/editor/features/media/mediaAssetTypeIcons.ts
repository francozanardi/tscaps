import { AudioLines, Film, Image, ImagePlay, type LucideIcon } from 'lucide-react';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

/** The icon each kind of media file is marked with, wherever a file stands for itself without a poster. */
export const MEDIA_ASSET_TYPE_ICONS: Readonly<Record<MediaAssetType, LucideIcon>> = {
  video: Film,
  image: Image,
  gif: ImagePlay,
  audio: AudioLines,
};
