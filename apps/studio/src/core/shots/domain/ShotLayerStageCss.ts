/**
 * The stage stylesheets shot layers are drawn by that do not change from
 * one stage to the next, written in the template library's Sass
 * (`presets/layer/stage/`): the layout framework every layer's box is
 * built by, and how each transition between shots plays. Each is bare
 * CSS; the stage builder puts it in its cascade layer.
 */
export interface ShotLayerStageCss {
  readonly framework: string;
  readonly shotTransitions: string;
}
