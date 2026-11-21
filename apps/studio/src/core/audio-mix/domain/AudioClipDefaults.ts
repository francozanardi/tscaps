import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import { AudioMixSanitizer } from '@core/audio-mix/domain/AudioMixSanitizer';

const VIDEO_START: AudioAnchorPoint = { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 };
const VIDEO_END: AudioAnchorPoint = { anchor: { kind: 'video', edge: 'end' }, offsetSec: 0 };

/**
 * What a new clip of each role starts with. Applied once, when the clip
 * is added; nothing follows it afterwards, so changing a default moves
 * no clip already placed.
 *
 * | | Effect | Music |
 * |---|---|---|
 * | Start → end | the draft's start → none | the video's start → the video's end |
 * | Loop | never | on |
 * | Lowered under speech | off | off, −12 dB once turned on |
 * | Fades | none | 1 s in, 2 s out |
 */
export class AudioClipDefaults {
  /** `draft` as a whole clip under `id`, every setting it leaves out taken from its role. */
  clipFrom(id: string, draft: AudioClipDraft): AudioClip {
    const isMusic = draft.role === 'music';
    return {
      id,
      role: draft.role,
      source: draft.source,
      start: draft.start ?? VIDEO_START,
      end: draft.end !== undefined ? draft.end : isMusic ? VIDEO_END : null,
      inSec: draft.inSec ?? 0,
      loop: isMusic,
      volume: draft.volume ?? 1,
      fadeInSec: isMusic ? 1 : 0,
      fadeOutSec: isMusic ? 2 : 0,
      ducking: { enabled: false, depthDb: AudioMixSanitizer.DEFAULT_DUCKING_DEPTH_DB },
    };
  }
}
