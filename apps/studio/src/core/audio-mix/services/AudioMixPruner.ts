import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type {
  OriginalCaptions,
  OriginalCaptionsSource,
  OriginalCaptionTrackReader,
} from '@core/translations/services/OriginalCaptionTrackReader';

/** What a project holds that a clip's anchors can name. */
export interface AudioAnchorHolder extends OriginalCaptionsSource {
  readonly audio: AudioMix;
  readonly shots: ShotPartition;
}

/** What the Original track holds that an anchor can name: its words, and its emojis not removed, by id. */
interface HeldCaptions {
  readonly wordIds: ReadonlySet<string>;
  readonly emojiIds: ReadonlySet<string>;
}

/**
 * Drops what names something gone, for a mix about to be stored: the
 * clips whose start anchor is gone (a word no longer in the Original
 * track, an emoji no word of it holds or one removed, a shot the
 * partition no longer holds, a layer no shot holds),
 * the sound of a layer no shot holds, and the video level of a shot the
 * partition no longer holds. A clip whose end anchor alone is gone
 * stays, playing as if it had none, and so does one on a graphic's moment
 * its code no longer declares, while its layer is there: the next edit of
 * the code may declare it again. So does one on an emoji its captions do
 * not show: another template or setting may show it.
 *
 * In memory nothing is pruned, so an undo brings a clip back with what
 * it was anchored to; once stored, no undo can.
 */
export class AudioMixPruner {
  constructor(private readonly originalCaptions: OriginalCaptionTrackReader) {}

  /** The holder's mix without its detached clips; the same mix where none is. */
  prune(holder: AudioAnchorHolder): AudioMix {
    return this.withoutDetachedClips(holder)
      .withFootageSound(this.goneLayerIdsOf(holder), 0)
      .withShotVideoVolume(this.goneShotIdsOf(holder), 1);
  }

  private withoutDetachedClips(holder: AudioAnchorHolder): AudioMix {
    if (!holder.audio.hasClips()) return holder.audio;
    const captions = this.heldCaptionsOf(this.originalCaptions.read(holder));
    const detached = holder.audio.clips()
      .filter((clip) => !this.isHeld(clip.start.anchor, captions, holder.shots))
      .map((clip) => clip.id);
    return holder.audio.withoutClips(detached);
  }

  private goneLayerIdsOf(holder: AudioAnchorHolder): string[] {
    return holder.audio.footageSounds().map((sound) => sound.layerId).filter((layerId) => holder.shots.findLayer(layerId) === null);
  }

  private goneShotIdsOf(holder: AudioAnchorHolder): string[] {
    const held = new Set(holder.shots.list().map((shot) => shot.id));
    return [...holder.audio.shotVideoVolumes().keys()].filter((shotId) => !held.has(shotId));
  }

  private isHeld(anchor: AudioAnchor, captions: HeldCaptions, shots: ShotPartition): boolean {
    switch (anchor.kind) {
      case 'word':
        return captions.wordIds.has(anchor.wordId);
      case 'emoji':
        return captions.emojiIds.has(anchor.decorationId);
      case 'shot':
        return shots.list().some((shot) => shot.id === anchor.shotId);
      case 'transition':
        return shots.list().some((shot) => shot.id === anchor.shotId && shot.transition !== undefined);
      case 'camera':
        return shots.hasCamera(anchor.shotId);
      case 'layer-camera':
        return shots.hasLayerCamera(anchor.layerId);
      case 'layer':
      case 'layer-transition':
      case 'layer-moment':
        return shots.findLayer(anchor.layerId) !== null;
      case 'video':
        return true;
    }
  }

  private heldCaptionsOf(original: OriginalCaptions): HeldCaptions {
    const words = original.document?.getWords() ?? [];
    return {
      wordIds: new Set(words.map((word) => word.id)),
      emojiIds: new Set(words.flatMap((word) => (
        word.decoration === null || original.decorationOverrides.get(word.decoration.id).removed ? [] : [word.decoration.id]
      ))),
    };
  }
}
