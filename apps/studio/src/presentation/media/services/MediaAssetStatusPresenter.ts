import type { MediaAssetPreparationStatus } from '@core/media/domain/MediaAssetPreparationStatus';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetUploadRefusal, MediaAssetUploadStatus } from '@core/media/domain/MediaAssetUploadStatus';

/** Where one media file stands, as read from the media module. */
export interface MediaAssetStatus {
  /** Whether the open project can use the file at all: false once it was deleted, here or elsewhere. */
  readonly exists: boolean;
  /** What kind of file it is; null once it no longer exists. */
  readonly type: MediaAssetType | null;
  /** Whether the file can be shown yet. */
  readonly preparation: MediaAssetPreparationStatus | null;
  /** Where the file itself stands on its way up; null where nothing is sent. */
  readonly upload: MediaAssetUploadStatus | null;
}

/**
 * Which of the states a file is shown in. `failed` covers both a
 * preparation and an upload that did not finish; `refused` an upload
 * the remote copy will not take; `missing` a file whose bytes are not
 * on this device; `unplayable` a file this browser cannot play;
 * `deleted` a file a shot names that no longer exists.
 */
export type MediaAssetDisplayState =
  | 'preparing' | 'uploading' | 'ready' | 'failed' | 'refused' | 'missing' | 'unplayable' | 'deleted';

/**
 * What a media file's state reads as in the chrome.
 *
 * - `tone`: `busy` while it is prepared or sent, `alert` when something
 *   needs the reader, `ready` otherwise.
 * - `step`: which step is under way while busy.
 * - `progress`: the fraction of that step, when it is known.
 * - `note`: one sentence saying where it stands; none once it is ready,
 *   which is the state that needs no word.
 * - `badge`: the same state as a status pill's word, for where a
 *   sentence does not fit; none once it is ready.
 * - `retryable`: whether trying again could change anything.
 */
export interface MediaAssetStatusView {
  readonly state: MediaAssetDisplayState;
  readonly tone: 'ready' | 'busy' | 'alert';
  readonly step: 'preparing' | 'uploading' | null;
  readonly progress: number | null;
  readonly note: string | null;
  readonly badge: string | null;
  readonly retryable: boolean;
}

/**
 * Turns where a file stands into what the chrome says about it. Reads
 * whether the file still exists first, then its preparation, then its
 * upload: a file that cannot be shown here says so before it says
 * anything about its remote copy.
 */
export class MediaAssetStatusPresenter {
  present({ exists, type, preparation, upload }: MediaAssetStatus): MediaAssetStatusView {
    if (!exists) return this.alert('deleted', 'This file was deleted. Pick another one.', 'Deleted', false);
    switch (preparation?.phase) {
      case 'preparing':
        return this.busy('preparing', preparation.progress, 'Getting the file ready to play.', 'Preparing');
      case 'failed':
        return this.alert('failed', "The file couldn't be made ready to play.", 'Failed', true);
      case 'missing':
        return this.alert('missing', 'The file is not on this device. Add it again.', 'Missing', false);
      case 'unplayable':
        return this.alert('unplayable', this.unplayableNoteOf(type), "Can't play", false);
      default:
        break;
    }
    switch (upload?.phase) {
      case 'waiting':
      case 'uploading':
        return this.busy('uploading', upload.progress, 'Uploading the file.', 'Uploading');
      case 'refused':
        return this.alert('refused', this.refusalNoteOf(upload.refusal ?? null), 'Refused', false);
      case 'failed':
        return this.alert('failed', "The file didn't finish uploading.", 'Failed', true);
      default:
        return { state: 'ready', tone: 'ready', step: null, progress: null, note: null, badge: null, retryable: false };
    }
  }

  private busy(step: 'preparing' | 'uploading', progress: number | null, note: string, badge: string): MediaAssetStatusView {
    return { state: step, tone: 'busy', step, progress, note, badge, retryable: false };
  }

  private alert(state: MediaAssetDisplayState, note: string, badge: string, retryable: boolean): MediaAssetStatusView {
    return { state, tone: 'alert', step: null, progress: null, note, badge, retryable };
  }

  /** Only a GIF and an audio file are ever found unplayable; each says what to do instead. */
  private unplayableNoteOf(type: MediaAssetType | null): string {
    return type === 'audio'
      ? "This audio file can't play in your browser. Save it as MP3 or WAV, then add it again."
      : "This GIF can't play in your browser. Pick another picture or GIF.";
  }

  private refusalNoteOf(refusal: MediaAssetUploadRefusal | null): string {
    switch (refusal) {
      case 'count':
        return 'You keep as many files as your plan allows. Delete some files to upload this one.';
      case 'storage':
        return 'This file does not fit in the space your plan has left. Delete some files to upload it.';
      case 'owner-gone':
        return 'The project this file belongs to was deleted.';
      case 'file':
      case null:
        return 'This file cannot be uploaded. Check its type and size.';
    }
  }
}
