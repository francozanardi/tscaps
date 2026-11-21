import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  weba: 'audio/webm',
};

/**
 * The containers that hold sound alone as often as footage, and the
 * type each is kept as when it does: a browser names a `.webm` or an
 * `.mp4` a video whatever it holds.
 */
const SOUND_ONLY_MIME_BY_VIDEO_MIME: Readonly<Record<string, string>> = {
  'video/webm': 'audio/webm',
  'video/mp4': 'audio/mp4',
};

/**
 * Tells which kind of asset a picked file is, from the type the browser
 * gives it or, when it gives none, from its extension. Answers null for
 * a file the editor takes as none of them.
 */
export class MediaAssetTypeDetector {
  typeOf(file: File): MediaAssetType | null {
    const mimeType = this.mimeTypeOf(file);
    if (mimeType === 'image/gif') return 'gif';
    if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return null;
  }

  /** The type the file is sent and kept as: the browser's, or the one its extension names. */
  mimeTypeOf(file: File): string {
    if (file.type) return file.type;
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
    return MIME_BY_EXTENSION[extension] ?? '';
  }

  /**
   * The audio type a file of the video type `mimeType` is kept as when it
   * turns out to hold sound and no picture; null for a video type that is
   * not taken as sound.
   */
  soundOnlyMimeTypeOf(mimeType: string): string | null {
    return SOUND_ONLY_MIME_BY_VIDEO_MIME[mimeType] ?? null;
  }
}
