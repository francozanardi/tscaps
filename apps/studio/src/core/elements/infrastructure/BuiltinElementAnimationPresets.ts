// eslint-disable-next-line no-restricted-syntax -- The animation library sits outside src, where no path alias reaches.
import captionPresets from '../../../../../../presets/templates/_lib/animation/presets.build.json';
// eslint-disable-next-line no-restricted-syntax -- The same, for the shot layers' list beside it.
import layerPresets from '../../../../../../presets/layer/animation/presets.build.json';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';

// Compiled from the two lists, the captions' (`presets/templates/_lib/animation/presets.scss`)
// and the shot layers' (`presets/layer/animation/presets.scss`), and each
// animation's own `controls.json` by `pnpm --filter
// @tscaps/studio-close presets:build`, which the postinstall hook
// runs. Gitignored and regenerated, like the per-template build
// artifacts beside it.
// Imported rather than globbed so a build that never produced it fails
// here instead of leaving an empty list to explain later.
//
// The cast narrows what JSON widens: the build writes this file from
// `ElementAnimationPreset` itself, so the shape holds by construction,
// but a string in JSON carries no union with it.
export const BUILTIN_ELEMENT_ANIMATION_PRESETS = [
  ...captionPresets,
  ...layerPresets,
] as ReadonlyArray<ElementAnimationPreset>;
