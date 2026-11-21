import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';

/** The element whose sound page lists the sound: a shot, or one shot layer. */
export type SoundPageOwner =
  | { readonly kind: 'shot'; readonly shotId: string }
  | { readonly kind: 'layer'; readonly layerId: string };

/** An inspector page a sound can be changed on. */
export type SoundOriginPage = 'sound' | 'motion' | 'camera';

/**
 * Where a sound is changed from, seen from a sound page: another page of
 * the same inspector (`tab`, with the layer transition's edge where that
 * page shows it), another element's inspector opened on a page, or the
 * transition into a shot, which the Video mode opens beside the shot.
 */
export type SoundOriginDestination =
  | { readonly kind: 'tab'; readonly page: SoundOriginPage; readonly transitionEdge: 'entrance' | 'exit' | null; readonly label: string }
  | { readonly kind: 'layer'; readonly layerId: string; readonly page: SoundOriginPage; readonly label: string }
  | { readonly kind: 'word'; readonly wordId: string; readonly label: string }
  | { readonly kind: 'shot-transition'; readonly shotId: string; readonly label: string };

/**
 * Where a sound listed on an element's sound page, but played by
 * something else, is changed from: its camera, its layout transition, a
 * layer of the shot, a word, the transition into the shot. A sound on
 * the page's own element is already where it is changed.
 */
export class SoundOriginDestinations {
  /** Where a sound on `anchor`, listed on `owner`'s sound page, goes; null where it goes nowhere. */
  destinationOf(anchor: AudioAnchor, owner: SoundPageOwner): SoundOriginDestination | null {
    switch (anchor.kind) {
      case 'camera':
        return owner.kind === 'shot' && owner.shotId === anchor.shotId ? this.tab('camera', null, 'Open the camera') : null;
      case 'layer-camera':
        return this.onLayer(anchor.layerId, owner, 'camera', null, 'Open its camera');
      case 'layer-transition':
        return this.onLayer(anchor.layerId, owner, 'motion', anchor.edge, 'Open its motion');
      case 'layer':
      case 'layer-moment':
        return owner.kind === 'layer' && owner.layerId === anchor.layerId
          ? null
          : { kind: 'layer', layerId: anchor.layerId, page: 'sound', label: 'Open its sound' };
      case 'word':
        return { kind: 'word', wordId: anchor.wordId, label: 'Open the word' };
      case 'transition':
        return { kind: 'shot-transition', shotId: anchor.shotId, label: 'Open the transition' };
      case 'emoji':
      case 'shot':
      case 'video':
        return null;
    }
  }

  // A layer's own page is a tab away; another layer is opened on that page.
  private onLayer(
    layerId: string,
    owner: SoundPageOwner,
    page: SoundOriginPage,
    transitionEdge: 'entrance' | 'exit' | null,
    label: string,
  ): SoundOriginDestination {
    return owner.kind === 'layer' && owner.layerId === layerId
      ? this.tab(page, transitionEdge, label)
      : { kind: 'layer', layerId, page, label };
  }

  private tab(page: SoundOriginPage, transitionEdge: 'entrance' | 'exit' | null, label: string): SoundOriginDestination {
    return { kind: 'tab', page, transitionEdge, label };
  }
}
