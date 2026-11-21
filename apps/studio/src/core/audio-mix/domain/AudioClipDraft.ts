import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

interface AudioClipDraftBase {
  readonly source: AudioSourceRef;
  /** Absent takes the role's default; `null` asks for none. */
  readonly end?: AudioAnchorPoint | null;
  /** Absent starts at the file's start. */
  readonly inSec?: number;
  /** Linear gain; absent plays the file at its own level. */
  readonly volume?: number;
}

/**
 * What adding a clip names; every setting it leaves out is the role's
 * default. An effect always says where it starts; music starts at the
 * video's start unless told otherwise.
 */
export type AudioClipDraft =
  | (AudioClipDraftBase & { readonly role: 'effect'; readonly start: AudioAnchorPoint })
  | (AudioClipDraftBase & { readonly role: 'music'; readonly start?: AudioAnchorPoint });
