// eslint-disable-next-line no-restricted-syntax -- The template library sits outside src, where no path alias reaches.
import builtStage from '../../../../../../presets/layer/stage/stage.build.json';
import type { ShotLayerStageCss } from '@core/shots/domain/ShotLayerStageCss';

// Compiled from `presets/layer/stage/stage.scss` and
// `shot-transitions.scss` by `pnpm --filter @tscaps/studio-close
// presets:build`, which the postinstall hook runs. Gitignored and
// regenerated, like the animation presets beside it. Imported rather
// than read at run time, so a build that never produced it fails here.
export const BUILTIN_SHOT_LAYER_STAGE_CSS: ShotLayerStageCss = builtStage;
