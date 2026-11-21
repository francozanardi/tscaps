import type { ElementAnimationPhase } from '@core/elements/domain/ElementAnimationScope';
import type { CaptionElementKind, ElementKind } from '@core/elements/domain/ElementKind';

/**
 * What each kind of element is called on screen.
 *
 * A UI answer, not a domain one: `segment` is the word the code uses
 * and "Scene" is the word the user has been reading since the timeline.
 * Kept in one place so two surfaces cannot call the same thing by two
 * names.
 */
export const ELEMENT_KIND_LABELS: Readonly<Record<ElementKind, string>> = {
  segment: 'Scene',
  line: 'Line',
  word: 'Word',
  decoration: 'Emoji',
  layer: 'Layer',
};

/**
 * What the parts of a kind an animation moves inside an element are
 * called on screen: every one of them, so the plural.
 *
 * Plural against the singular of {@link ELEMENT_KIND_LABELS}, which is
 * the whole distinction on screen: `Scene` is the one being edited and
 * `Scenes` is every one of them.
 */
export const ANIMATED_PART_LABELS: Readonly<Record<CaptionElementKind, string>> = {
  segment: 'Scenes',
  line: 'Lines',
  word: 'Words',
  decoration: 'Emojis',
};

/**
 * What each end of an element's life is called where its motion is
 * picked: the same two words on a caption and on a shot layer, in the
 * same strip, so the strip means one thing wherever it appears.
 */
export const ANIMATION_END_LABELS: Readonly<Record<ElementAnimationPhase, string>> = {
  entrance: 'Entrance',
  exit: 'Exit',
  camera: 'Camera',
};

/**
 * Why an animation panel is locked, for a template whose look does not
 * survive one landing there.
 *
 * Names the look as the reason rather than the mechanism: a user cannot
 * act on a stacking context, and what they can do — leave the captions
 * unanimated — is what the sentence leaves them with. Shared by the two
 * surfaces that lock, so neither can explain it differently.
 */
export const UNSUPPORTED_ANIMATION_MESSAGE =
  'This template blends its captions with the video. Animating them would cut the blend, '
  + 'so it offers no animation here.';
