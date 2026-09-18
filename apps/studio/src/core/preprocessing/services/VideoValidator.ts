import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TranscriptionAudioLengthPolicy } from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import type { VideoState } from '@core/editor/domain/VideoState';
import type {
  UnreadableReason,
  VideoRejectionDetails,
  VideoValidationStatus,
} from '@core/preprocessing/domain/VideoValidationStatus';

/**
 * Single source of truth for whether the currently loaded video is
 * eligible for preprocessing. Watches the editor store and the
 * audio-length policy and republishes a `change` event whenever the
 * derived status transitions between `no-video`, `analyzing`,
 * `accepted`, and `rejected`. Consumers subscribe to that event and
 * read `status()` — no caller re-derives the decision from raw
 * signals.
 *
 * Intermediate mutations that do not flip the status (a `timechange`
 * on the editor store, an unrelated capabilities refresh) are
 * absorbed — subscribers only see meaningful transitions.
 */
export class VideoValidator extends EventTarget {
  private currentStatus: VideoValidationStatus;
  private detachEditor: (() => void) | null = null;
  private detachPolicy: (() => void) | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly audioLengthPolicy: TranscriptionAudioLengthPolicy,
  ) {
    super();
    this.currentStatus = this.computeStatus();
  }

  status(): VideoValidationStatus {
    return this.currentStatus;
  }

  start(): void {
    if (this.detachEditor || this.detachPolicy) return;
    const recompute = (): void => this.refreshStatus();
    this.editorStore.addEventListener('change', recompute);
    this.detachEditor = () => this.editorStore.removeEventListener('change', recompute);
    this.detachPolicy = this.audioLengthPolicy.subscribe(recompute);
    this.refreshStatus();
  }

  stop(): void {
    this.detachEditor?.();
    this.detachPolicy?.();
    this.detachEditor = null;
    this.detachPolicy = null;
  }

  private refreshStatus(): void {
    const next = this.computeStatus();
    if (statusEquals(this.currentStatus, next)) return;
    this.currentStatus = next;
    this.dispatchEvent(new Event('change'));
  }

  private computeStatus(): VideoValidationStatus {
    const { video } = this.editorStore.snapshot();
    if (video.file === null) return { state: 'no-video' };
    if (video.isProbing) return { state: 'analyzing' };
    // A settled `duration` of `0` means the probe exhausted both the
    // container metadata and the packet-scan fallback without finding
    // a length. The editor cannot preprocess a video whose length is
    // unknown, so the file is rejected instead of being left in
    // `analyzing` with no way out.
    if (video.duration <= 0) {
      return { state: 'rejected', details: { type: 'unreadable', reason: this.unreadableReason(video) } };
    }
    const cap = this.audioLengthPolicy.capState();
    if (cap.state === 'resolving') return { state: 'analyzing' };
    if (cap.state === 'no-cap') return { state: 'accepted' };
    if (video.duration > cap.seconds) {
      return {
        state: 'rejected',
        details: {
          type: 'over-cap',
          capSeconds: cap.seconds,
          videoDurationSeconds: video.duration,
        },
      };
    }
    return { state: 'accepted' };
  }

  /**
   * A source whose bytes the runtime refused is a different failure
   * from one whose bytes said nothing a parser recognised, and only
   * the probe can tell them apart. An unprobed source (`null`) is
   * reported as a container problem, which is the case that a
   * different file actually fixes.
   */
  private unreadableReason(video: VideoState): UnreadableReason {
    return video.isSourceReadable === false ? 'source-unreadable' : 'container-unreadable';
  }
}

function statusEquals(a: VideoValidationStatus, b: VideoValidationStatus): boolean {
  if (a.state !== b.state) return false;
  if (a.state === 'rejected' && b.state === 'rejected') {
    return rejectionEquals(a.details, b.details);
  }
  return true;
}

function rejectionEquals(a: VideoRejectionDetails, b: VideoRejectionDetails): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'over-cap' && b.type === 'over-cap') {
    return a.capSeconds === b.capSeconds && a.videoDurationSeconds === b.videoDurationSeconds;
  }
  if (a.type === 'unreadable' && b.type === 'unreadable') return a.reason === b.reason;
  return true;
}
