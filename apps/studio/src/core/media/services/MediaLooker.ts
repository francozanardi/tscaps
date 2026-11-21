import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaFilePicture, MediaFilePictures } from '@core/media/domain/MediaFilePictures';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { EncodedPicture, LabeledPicture, PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';

/** At most this many files in one look. */
export const MEDIA_LOOK_MAX_FILES = 6;
/** At most this many moments of one GIF or video. */
export const MEDIA_LOOK_MAX_MOMENTS_PER_FILE = 8;
/** At most this many pictures in one look, all files together. */
export const MEDIA_LOOK_MAX_PICTURES = 12;

// Moments spread over a GIF or a video when none are asked: more when it is the only file looked at.
const SPREAD_ALONE = 4;
const SPREAD_AMONG_OTHERS = 2;
// A GIF says nothing of how long it runs; moments this far apart see most loops through.
const GIF_STEP_SEC = 0.5;
const PICTURE_MAX_SIDE_PX = 1024;
const SHEET = { maxWidthPx: 1280, maxHeightPx: 960 };
// A file named the way a ref is written; the id after it is what the media list holds.
const MEDIA_PREFIX = 'media:';

/** One file asked for: its media id (or `media:<id>`), and the moments to see of it, unchecked. */
export interface MediaLookItem {
  readonly media: unknown;
  readonly times: unknown;
}

/** What a look found: one sheet of every picture and a line per file, or why there is nothing to see. */
export type MediaLook =
  | { readonly ok: true; readonly sheet: EncodedPicture; readonly summary: string }
  | { readonly ok: false; readonly problem: string };

/** One file asked for, as found in the bin, with the moments to see of it. */
interface LookedAtFile {
  readonly asset: MediaAsset;
  readonly times: ReadonlyArray<number>;
}

/** What was asked for: the files to draw, and why any other was left out. */
interface LookRequest {
  readonly files: ReadonlyArray<LookedAtFile>;
  readonly notes: ReadonlyArray<string>;
}

/**
 * Some of the person's files in the media bin, as they are, in one
 * picture: a picture whole, a GIF or a video at moments of its own
 * timeline (seconds from its start), spread over it when none are
 * asked, each labelled. Audio has no picture. A file that is not in the
 * bin, or cannot be read, is left out with a note saying so.
 */
export class MediaLooker {
  constructor(
    private readonly media: MediaAssetStore,
    private readonly pictures: MediaFilePictures,
    private readonly composer: PictureSheetComposer,
  ) {}

  /** Rejects only when `signal` aborts. */
  async look(items: ReadonlyArray<MediaLookItem>, signal: AbortSignal): Promise<MediaLook> {
    if (items.length === 0 || items.length > MEDIA_LOOK_MAX_FILES) return { ok: false, problem: `Ask for 1 to ${MEDIA_LOOK_MAX_FILES} files.` };
    const request = this.requestOf(items);
    if (request.files.length === 0) return { ok: false, problem: request.notes.join(' ') };
    const count = request.files.reduce((sum, file) => sum + (file.asset.type === 'image' ? 1 : file.times.length), 0);
    if (count > MEDIA_LOOK_MAX_PICTURES) return { ok: false, problem: `That is ${count} pictures; ${MEDIA_LOOK_MAX_PICTURES} at most in one call. Ask for fewer moments or fewer files.` };
    const drawn: Array<{ readonly asset: MediaAsset; readonly picture: MediaFilePicture }> = [];
    const notes = [...request.notes];
    try {
      for (const file of request.files) {
        const pictures = await this.draw(file, signal, notes);
        for (const picture of pictures) drawn.push({ asset: file.asset, picture });
      }
      if (drawn.length === 0) return { ok: false, problem: notes.join(' ') };
      const several = request.files.length > 1;
      const sheet = await this.composer.sheet(
        drawn.map(({ asset, picture }) => this.labelled(asset, picture, several)),
        { ...SHEET, region: null, backdrop: drawn.every(({ asset }) => asset.type === 'video') ? 'none' : 'checker' },
      );
      return { ok: true, sheet, summary: [...request.files.map((file) => this.summaryOf(file.asset)), ...notes].join('\n') };
    } finally {
      for (const { picture } of drawn) picture.bitmap.close();
    }
  }

  private requestOf(items: ReadonlyArray<MediaLookItem>): LookRequest {
    const files: LookedAtFile[] = [];
    const notes: string[] = [];
    const spread = items.length === 1 ? SPREAD_ALONE : SPREAD_AMONG_OTHERS;
    for (const item of items) {
      const asset = this.assetOf(item.media);
      if (asset === null) {
        notes.push(`No file has the id "${String(item.media)}"; list_catalog (media) lists the person's files.`);
        continue;
      }
      if (asset.type === 'audio') {
        notes.push(`"${asset.fileName}" is an audio file, which has no picture to look at.`);
        continue;
      }
      const times = item.times === undefined ? this.spreadOver(asset, spread) : this.timesOf(item.times, asset);
      if (times === null) {
        notes.push(`"${asset.fileName}" was left out: times must be 1 to ${MEDIA_LOOK_MAX_MOMENTS_PER_FILE} numbers of seconds, 0 or more.`);
        continue;
      }
      files.push({ asset, times });
    }
    return { files, notes };
  }

  private async draw(file: LookedAtFile, signal: AbortSignal, notes: string[]): Promise<ReadonlyArray<MediaFilePicture>> {
    try {
      const pictures = await this.pictures.picturesOf(file.asset, file.times, PICTURE_MAX_SIDE_PX, signal);
      if (pictures.length === 0) notes.push(`"${file.asset.fileName}" showed no picture at those moments.`);
      return pictures;
    } catch (error) {
      if (signal.aborted) throw error;
      notes.push(`"${file.asset.fileName}" could not be read: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private assetOf(value: unknown): MediaAsset | null {
    if (typeof value !== 'string' || value === '') return null;
    const id = value.startsWith(MEDIA_PREFIX) ? value.slice(MEDIA_PREFIX.length) : value;
    return this.media.snapshot().get(id);
  }

  /** `count` moments spread over a video's length, or a GIF's first seconds; a picture needs none. */
  private spreadOver(asset: MediaAsset, count: number): number[] {
    if (asset.type === 'image') return [];
    if (asset.type !== 'video' || asset.durationSec === null || asset.durationSec <= 0) {
      return Array.from({ length: count }, (_, index) => index * GIF_STEP_SEC);
    }
    const durationSec = asset.durationSec;
    return Array.from({ length: count }, (_, index) => Number((durationSec * (index + 0.5) / count).toFixed(2)));
  }

  /** The moments asked, in order and each once, a video's kept inside its length; null when they are not moments. */
  private timesOf(value: unknown, asset: MediaAsset): number[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > MEDIA_LOOK_MAX_MOMENTS_PER_FILE) return null;
    if (!value.every((time) => typeof time === 'number' && Number.isFinite(time) && time >= 0)) return null;
    if (asset.type === 'image') return [];
    const lastSec = asset.type === 'video' && asset.durationSec !== null && asset.durationSec > 0 ? Math.max(0, asset.durationSec - 0.05) : Infinity;
    return [...new Set((value as number[]).map((time) => Math.min(time, lastSec)))].sort((first, second) => first - second);
  }

  private labelled(asset: MediaAsset, picture: MediaFilePicture, several: boolean): LabeledPicture {
    if (picture.fileSec === null) return { bitmap: picture.bitmap, label: asset.fileName };
    const moment = `${picture.fileSec.toFixed(2)} s`;
    return { bitmap: picture.bitmap, label: several ? `${asset.fileName} · ${moment}` : moment };
  }

  private summaryOf(asset: MediaAsset): string {
    const size = asset.widthPx !== null && asset.heightPx !== null ? `${asset.widthPx}x${asset.heightPx} ` : '';
    const kind = asset.type === 'image' ? 'picture' : asset.type === 'gif' ? 'GIF' : 'video';
    const length = asset.durationSec !== null ? `, ${asset.durationSec.toFixed(1)} s long` : '';
    return `"${asset.fileName}": a ${size}${kind}${length}.`;
  }
}
