import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ImageDimensions, ImageDimensionsProbe } from '@core/media/domain/ImageDimensionsProbe';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import { MediaAssetLimits } from '@core/media/domain/MediaAssetLimits';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import { MEDIA_ASSET_TYPES, type MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import { MediaAssetImportFailedError } from '@core/media/domain/errors/MediaAssetImportFailedError';
import { MediaAssetNotAcceptedHereError } from '@core/media/domain/errors/MediaAssetNotAcceptedHereError';
import { MediaAssetTooLargeError } from '@core/media/domain/errors/MediaAssetTooLargeError';
import { MediaAssetTooLongError } from '@core/media/domain/errors/MediaAssetTooLongError';
import { MediaAssetTooManyPixelsError } from '@core/media/domain/errors/MediaAssetTooManyPixelsError';
import { MediaAssetUnsupportedTypeError } from '@core/media/domain/errors/MediaAssetUnsupportedTypeError';
import type { MediaAssetOwnerResolver, MediaAssetDestination } from '@core/media/services/MediaAssetOwnerResolver';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaImportOrigin, MediaImportTelemetryReporter } from '@core/media/services/MediaImportTelemetryReporter';
import type { MediaAssetTypeDetector } from '@core/media/services/MediaAssetTypeDetector';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/** What reading a picked file found: what kind of file it is, and what that kind is recorded with. */
interface ReadFile {
  readonly type: MediaAssetType;
  /** The type the file is sent and kept as. */
  readonly mimeType: string;
  /** Null for an audio file, which has no size in pixels. */
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly durationSec: number | null;
}

/**
 * Adds a file to the open project or to the user's library: tells what
 * kind of asset it is, reads what that kind needs, keeps its bytes and
 * records it. Resolves with the asset, whose id is what anything using
 * it then names — once it is ready.
 *
 * Each kind is read its own way: a video must hold a readable video
 * and an audio file a readable sound, each running no longer than its
 * kind may ({@link MediaAssetLimits.MAX_DURATION_SEC}); a picture or a
 * GIF must be a picture this browser can read. A WebM or MP4 file holding
 * sound and no picture is taken as an audio file, whatever the browser
 * named it. Pictures, GIFs and videos have their size in pixels recorded,
 * and none may be wider or taller than {@link MediaAssetLimits.MAX_SIDE_PX};
 * an audio file has none. No file may weigh more than its kind allows. A
 * file refused for any of these is refused before anything is kept, with
 * the reason in the failure's `cause` — and so is one of a kind other
 * than `accepted`, where the file was added for something that takes
 * only some kinds, and one added to a library that is not open to
 * whoever uses the editor now.
 *
 * Nothing is recorded when the bytes could not be kept, so a recorded
 * asset always has a file behind it. Adding is not an edit: undo does
 * not take it back, and the project is not marked unsaved, since its
 * payload names no asset until something uses one.
 *
 * Two things start in the background: the asset is made ready, and its
 * file starts going up wherever there is a remote copy.
 *
 * `origin` says where in the editor the file was added from; it changes
 * nothing but what is reported.
 */
export class ImportMediaAssetAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly assets: MediaAssetStore,
    private readonly repository: MediaAssetRepository,
    private readonly bytes: MediaAssetBytesRepository,
    private readonly typeDetector: MediaAssetTypeDetector,
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly imageProbe: ImageDimensionsProbe,
    private readonly owners: MediaAssetOwnerResolver,
    private readonly uploader: MediaAssetUploader,
    private readonly preparer: MediaAssetPreparer,
    private readonly telemetry: MediaImportTelemetryReporter,
  ) {}

  async execute(
    file: File,
    destination: MediaAssetDestination,
    origin: MediaImportOrigin,
    accepted: readonly MediaAssetType[] = MEDIA_ASSET_TYPES,
  ): Promise<MediaAsset> {
    try {
      const asset = await this.importFile(file, destination, accepted);
      this.telemetry.added(asset, destination, origin);
      return asset;
    } catch (error) {
      this.telemetry.failed(file, this.typeDetector.typeOf(file), destination, origin, error);
      throw error;
    }
  }

  private async importFile(file: File, destination: MediaAssetDestination, accepted: readonly MediaAssetType[]): Promise<MediaAsset> {
    const detected = this.typeDetector.typeOf(file);
    if (detected === null) throw this.failure(new MediaAssetUnsupportedTypeError(file.type));
    const mimeType = this.typeDetector.mimeTypeOf(file);
    if (!this.typesItMayBe(detected, mimeType).some((type) => accepted.includes(type))) {
      throw this.failure(new MediaAssetNotAcceptedHereError(detected, accepted));
    }
    this.assertSmallEnough(detected, file.size);
    const owner = this.ownerFor(destination);
    const read = await this.read(file, detected, mimeType);
    if (!accepted.includes(read.type)) throw this.failure(new MediaAssetNotAcceptedHereError(read.type, accepted));
    this.assertSmallEnough(read.type, file.size);
    this.assertShortEnough(read);
    this.assertFewEnoughPixels(read);
    const asset: MediaAsset = {
      id: crypto.randomUUID(),
      owner,
      fileName: file.name,
      sizeBytes: file.size,
      ...read,
    };
    await this.keep(asset, file);
    this.assets.put(asset);
    this.uploader.enqueue(asset, 'original');
    void this.preparer.prepare(asset);
    return asset;
  }

  /** The kinds a file named `detected` can turn out to be once read: a video container may hold sound alone. */
  private typesItMayBe(detected: MediaAssetType, mimeType: string): readonly MediaAssetType[] {
    if (detected === 'video' && this.typeDetector.soundOnlyMimeTypeOf(mimeType) !== null) return ['video', 'audio'];
    return [detected];
  }

  private ownerFor(destination: MediaAssetDestination): MediaAssetOwner {
    try {
      return this.owners.ownerFor(destination, this.editorStore.snapshot().projectId);
    } catch (cause) {
      throw this.failure(cause);
    }
  }

  private assertSmallEnough(type: MediaAssetType, sizeBytes: number): void {
    const max = MediaAssetLimits.MAX_BYTES[type];
    if (sizeBytes > max) throw this.failure(new MediaAssetTooLargeError(type, sizeBytes, max));
  }

  private read(file: File, detected: MediaAssetType, mimeType: string): Promise<ReadFile> {
    switch (detected) {
      case 'video':
        return this.readVideo(file, mimeType);
      case 'audio':
        return this.readAudio(file, mimeType);
      case 'image':
      case 'gif':
        return this.readPicture(file, detected, mimeType);
    }
  }

  private async readVideo(file: File, mimeType: string): Promise<ReadFile> {
    const metadata = await this.probe(file);
    const { videoWidthPx, videoHeightPx, durationSeconds } = metadata;
    if (metadata.sourceReadable && videoWidthPx !== null && videoHeightPx !== null) {
      return { type: 'video', mimeType, widthPx: videoWidthPx, heightPx: videoHeightPx, durationSec: durationSeconds };
    }
    const soundOnlyMimeType = this.typeDetector.soundOnlyMimeTypeOf(mimeType);
    if (metadata.sourceReadable && metadata.hasAudioTrack === true && soundOnlyMimeType !== null) {
      return { type: 'audio', mimeType: soundOnlyMimeType, widthPx: null, heightPx: null, durationSec: durationSeconds };
    }
    throw this.failure(new Error(`${file.name} holds no readable video`));
  }

  private async readAudio(file: File, mimeType: string): Promise<ReadFile> {
    const metadata = await this.probe(file);
    if (!metadata.sourceReadable || metadata.hasAudioTrack !== true) {
      throw this.failure(new Error(`${file.name} holds no readable sound`));
    }
    return { type: 'audio', mimeType, widthPx: null, heightPx: null, durationSec: metadata.durationSeconds };
  }

  private probe(file: File): Promise<VideoSourceMetadata> {
    return this.metadataProbe.probe(file).catch((cause: unknown) => {
      throw this.failure(cause);
    });
  }

  private async readPicture(file: File, type: 'image' | 'gif', mimeType: string): Promise<ReadFile> {
    let dimensions: ImageDimensions;
    try {
      dimensions = await this.imageProbe.probe(file);
    } catch (cause) {
      throw this.failure(cause);
    }
    return { type, mimeType, ...dimensions, durationSec: null };
  }

  /** A video or an audio file runs no longer than its kind may, and says how long it runs. */
  private assertShortEnough({ type, durationSec }: ReadFile): void {
    if (type !== 'video' && type !== 'audio') return;
    const max = MediaAssetLimits.MAX_DURATION_SEC[type];
    if (durationSec !== null && durationSec > 0 && durationSec <= max) return;
    throw this.failure(new MediaAssetTooLongError(type, durationSec, max));
  }

  private assertFewEnoughPixels({ widthPx, heightPx }: ReadFile): void {
    const max = MediaAssetLimits.MAX_SIDE_PX;
    if (widthPx === null || heightPx === null) return;
    if (widthPx > max || heightPx > max) throw this.failure(new MediaAssetTooManyPixelsError(widthPx, heightPx, max));
  }

  private async keep(asset: MediaAsset, file: File): Promise<void> {
    try {
      await this.bytes.store(asset, 'original', file);
      if (asset.owner.kind !== 'session') await this.repository.add(asset);
    } catch (cause) {
      // Best effort: bytes left behind are named by nothing, and go with their owner.
      await this.bytes.delete(asset.id).catch(() => undefined);
      throw this.failure(cause);
    }
  }

  private failure(cause: unknown): MediaAssetImportFailedError {
    return new MediaAssetImportFailedError({ cause });
  }
}
