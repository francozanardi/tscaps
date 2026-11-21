import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';

/**
 * A file the user added besides a project's video — footage, a
 * picture, a GIF, a sound. What is known about it, not its bytes, which
 * are held apart and looked up by `id`; whatever uses it names it by
 * that id and nothing else.
 */
export interface MediaAsset {
  readonly id: string;
  readonly type: MediaAssetType;
  readonly owner: MediaAssetOwner;
  readonly fileName: string;
  /** The type of the file as it was added. */
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Its size in pixels; null for what has none, an audio file. */
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  /** How long it plays, or null for what does not play or would not say. */
  readonly durationSec: number | null;
}
