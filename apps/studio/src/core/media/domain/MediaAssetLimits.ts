import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

const MB = 1024 * 1024;

/**
 * What one file of each type may be. The byte ceilings mirror the
 * server's per-type caps (`MEDIA_MAX_*_BYTES`), so a file this device
 * takes is one the server takes too; keep both in sync.
 */
export class MediaAssetLimits {
  static readonly MAX_BYTES: Readonly<Record<MediaAssetType, number>> = {
    video: 500 * MB,
    image: 20 * MB,
    gif: 50 * MB,
    audio: 50 * MB,
  };

  /**
   * The longest each type that plays may run. A b-roll runs no longer
   * than its shot, which is a few seconds; a video's cap leaves room to
   * pick the stretch while keeping the making of its proxy short on any
   * device. An audio file runs under a whole video, as its music.
   */
  static readonly MAX_DURATION_SEC: Readonly<Record<'video' | 'audio', number>> = {
    video: 60,
    audio: 10 * 60,
  };

  /** The widest or tallest a file may be, in pixels; mirrors the server's check at the door. */
  static readonly MAX_SIDE_PX = 16_384;

  /** The longest file name the server records, in UTF-16 code units as it counts them. */
  static readonly MAX_FILE_NAME_LENGTH = 255;
}
