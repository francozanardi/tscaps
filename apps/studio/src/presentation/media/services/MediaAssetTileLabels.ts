import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaFileUsage } from '@presentation/media/services/MediaFileUsage';

const BYTES_PER_MB = 1024 * 1024;

/** The words and figures one file's tile in the media bin shows. */
export class MediaAssetTileLabels {
  /** What kind of file it is, as a word a reader would use. */
  typeOf(type: MediaAssetType): string {
    switch (type) {
      case 'video':
        return 'Video';
      case 'image':
        return 'Picture';
      case 'gif':
        return 'GIF';
      case 'audio':
        return 'Audio';
    }
  }

  nameOf(asset: MediaAsset): string {
    return asset.fileName.trim() === '' ? 'Untitled file' : asset.fileName;
  }

  /**
   * How long it plays — a clip the way a shot's length reads, `7.0s`; an
   * audio file the way a song's does, `3:05` — or null for what does not
   * play.
   */
  durationOf(asset: MediaAsset): string | null {
    if (asset.durationSec === null) return null;
    return asset.type === 'audio' ? this.clockOf(asset.durationSec) : `${asset.durationSec.toFixed(1)}s`;
  }

  /**
   * What in the open project uses it — how many shots show it, whether
   * it is the music, how many sound effects play it — or, when nothing
   * does and `expiryWarning` is given, that warning: opening and saving
   * the project count as using the files it uses, so those are not the
   * ones to warn of.
   */
  usageOf(usage: MediaFileUsage | undefined, expiryWarning: string | null = null): string {
    const parts: string[] = [];
    if (usage !== undefined && usage.shots > 0) parts.push(usage.shots === 1 ? '1 shot' : `${usage.shots} shots`);
    if (usage?.isMusic) parts.push('Music');
    if (usage !== undefined && usage.soundEffects > 0) {
      parts.push(usage.soundEffects === 1 ? '1 sound' : `${usage.soundEffects} sounds`);
    }
    if (parts.length === 0) return expiryWarning ?? 'Not used';
    return parts.join(' · ');
  }

  /** Whether anything in the open project uses a file, as {@link usageOf} reads it. */
  isUsed(usage: MediaFileUsage | undefined): boolean {
    return usage !== undefined && (usage.shots > 0 || usage.isMusic || usage.soundEffects > 0);
  }

  /** That a file shown among the project's own is in the library, which every project can use. */
  libraryNote(): string {
    return 'In your library';
  }

  /** Its size in pixels and in bytes, as far as either is known; an audio file has no size in pixels. */
  detailsOf(asset: MediaAsset): string {
    const parts: string[] = [];
    const { widthPx, heightPx } = asset;
    if (widthPx !== null && heightPx !== null && widthPx > 0 && heightPx > 0) parts.push(`${widthPx} × ${heightPx}`);
    if (asset.sizeBytes > 0) parts.push(this.megabytesOf(asset.sizeBytes));
    return parts.join(' · ');
  }

  private clockOf(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  private megabytesOf(bytes: number): string {
    const megabytes = bytes / BYTES_PER_MB;
    return megabytes < 10 ? `${megabytes.toFixed(1)} MB` : `${Math.round(megabytes)} MB`;
  }
}
