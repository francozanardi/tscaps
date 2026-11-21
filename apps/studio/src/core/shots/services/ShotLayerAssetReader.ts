import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotFileLayer, ShotGraphicLayer, ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import type { ShotPictureLayer } from '@core/shots/domain/ShotPictureLayer';

/**
 * What the media files say about the asset a layer names: the one place
 * a file's type becomes how a layer treats it. A video plays, a picture
 * holds still, a GIF plays its own frames, looping.
 *
 * A graphic holds its own document, so it is always known: a graphic,
 * of the shape its box is made for, with no length of its own.
 *
 * A file the catalog does not hold — deleted elsewhere, or not listed
 * yet — is of no known type, and is never guessed: its layer is neither
 * the shot's b-roll nor a picture on top, nothing draws it, and it is
 * offered on its own so it can be seen and removed. A sound is read the
 * same way, since a shot has nothing to draw of it: no layer is ever
 * made of one, and a layer naming one is offered for removal.
 */
export class ShotLayerAssetReader {
  /** What the file is, or null when the catalog does not hold it or it is a sound. */
  read(mediaId: string, media: MediaAssetCatalog): ShotLayerAsset | null {
    const asset = media.get(mediaId);
    if (asset === null || asset.type === 'audio') return null;
    const { widthPx, heightPx } = asset;
    const aspectRatio = widthPx !== null && heightPx !== null && widthPx > 0 && heightPx > 0 ? widthPx / heightPx : null;
    if (asset.type === 'video') return { kind: 'video', durationSec: asset.durationSec, aspectRatio };
    return { kind: asset.type, durationSec: null, aspectRatio };
  }

  /** What a layer shows: its graphic, or what its file is, null when the catalog does not hold that file or it is a sound. */
  assetOf(layer: ShotLayer, media: MediaAssetCatalog): ShotLayerAsset | null {
    if ('graphic' in layer) return { kind: 'graphic', durationSec: null, aspectRatio: layer.graphic.aspectRatio };
    return this.read(layer.mediaId, media);
  }

  /** The file `layer` shows, or null for a graphic, which shows none. */
  fileOf(layer: ShotLayer): ShotFileLayer | null {
    return 'mediaId' in layer ? layer : null;
  }

  /** What a layer showing the file is for: a b-roll for a video, a picture on top for a picture or a GIF, null when the catalog does not hold it or it is a sound. */
  roleOf(mediaId: string, media: MediaAssetCatalog): ShotLayerRole | null {
    const kind = this.read(mediaId, media)?.kind;
    if (kind === undefined) return null;
    return kind === 'video' ? 'video' : 'picture';
  }

  /** Whether the file is footage that plays along the video — a b-roll — rather than a picture, a GIF, or unknown. */
  isVideo(mediaId: string, media: MediaAssetCatalog): boolean {
    return this.read(mediaId, media)?.kind === 'video';
  }

  /** A shot's b-roll: the lowest of `layers` showing a video, or null where none does. */
  videoLayerOf(layers: readonly ShotLayer[], media: MediaAssetCatalog): ShotFileLayer | null {
    return layers.find((layer): layer is ShotFileLayer => 'mediaId' in layer && this.isVideo(layer.mediaId, media)) ?? null;
  }

  /** The layers of `layers` showing a picture or a GIF, bottom to top. */
  pictureLayersOf(layers: readonly ShotLayer[], media: MediaAssetCatalog): ShotPictureLayer[] {
    return layers.flatMap((layer) => {
      if (!('mediaId' in layer)) return [];
      const kind = this.read(layer.mediaId, media)?.kind;
      return kind === 'image' || kind === 'gif' ? [{ layer, kind }] : [];
    });
  }

  /** The layers of `layers` showing a graphic, bottom to top. */
  graphicLayersOf(layers: readonly ShotLayer[]): ShotGraphicLayer[] {
    return layers.filter((layer): layer is ShotGraphicLayer => 'graphic' in layer);
  }

  /** The layers of `layers` naming a file the catalog does not hold, bottom to top. */
  missingLayersOf(layers: readonly ShotLayer[], media: MediaAssetCatalog): ShotFileLayer[] {
    return layers.filter((layer): layer is ShotFileLayer => 'mediaId' in layer && this.read(layer.mediaId, media) === null);
  }
}
