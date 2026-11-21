import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

/** What a file picker offers for a shot's b-roll. */
export const VIDEO_FILE_ACCEPT = 'video/*';

/** What a file picker offers for a picture or a GIF on a shot. */
export const PICTURE_FILE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/** The kinds a file added for a b-roll may be; the picker's filter can be set aside, the import cannot. */
export const VIDEO_FILE_TYPES: readonly MediaAssetType[] = ['video'];

/** The kinds a file added for a picture on a shot may be. */
export const PICTURE_FILE_TYPES: readonly MediaAssetType[] = ['image', 'gif'];

/** The kinds a shot can show; a sound is not one. */
export const SHOT_FILE_TYPES: readonly MediaAssetType[] = [...VIDEO_FILE_TYPES, ...PICTURE_FILE_TYPES];
