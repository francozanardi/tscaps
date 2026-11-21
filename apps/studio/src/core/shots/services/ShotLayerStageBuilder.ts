import { CssClass, DataAttribute, type FootageStyle } from '@tscaps/engine';
import { CssLayer } from '@tscaps/engine/advanced';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ElementStyle, ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { OutputFrameCss } from '@core/output-frame/services/OutputFrameCss';
import { ShotLayerCss } from '@core/shots/domain/ShotLayerCss';
import type { ShotLayerStageCss } from '@core/shots/domain/ShotLayerStageCss';
import type { StagedShotFollow } from '@core/shots/domain/StagedShotFollow';
import type { ShotFollowCameraWriter } from '@core/shots/services/ShotFollowCameraWriter';
import type { StagedShotTransition } from '@core/shots/services/ShotTransitionLayerBuilder';
import type { ShotTransitionStyleWriter } from '@core/shots/services/ShotTransitionStyleWriter';

/** A layer to put on the stage: its id, and its file's width over its height, null where not known. */
export interface StagedShotLayer {
  readonly layerId: string;
  readonly assetAspectRatio: number | null;
}

// A frame whose size is not known yet is taken as square.
const UNKNOWN_FRAME_SIDE_PX = 1000;
const ATTRIBUTE_VALUE_SPECIAL_CHARACTERS = /["\\]/g;

/**
 * Writes the stylesheet a set of shot layers is drawn by, for the
 * engine's footage stage — a frame-sized size container with one box
 * per layer, which the engine owns, sizes, and freezes to its clock —
 * the way a template's stylesheet is written for its captions. Five
 * cascade layers, each winning over the one before by arriving later:
 *
 * - The framework's, after the engine's own rules in the same layer:
 *   the layout framework, compiled from the template library
 *   (`ShotLayerStageCss.framework`, `presets/layer/stage/stage.scss`),
 *   which builds every box from its layout's fields; and the frame's
 *   shape on the stage, which it reads.
 * - The file's: each box's file's shape, generated, never part of the
 *   layer's own text.
 * - The element's: each layer's own CSS, as a caption element's is
 *   assembled — the declarations its fields write, its motion, and
 *   anything written by hand, which wins over both layers before it.
 * - The cameras that follow a person: each followed box's keyframes,
 *   over its own CSS, since a shot following someone is framed by them.
 * - The transitions between shots, last: each a whole-frame box of the
 *   framework's, playing its transition instead of what the framework
 *   plays.
 *
 * The framework's layer also puts the video in the output frame, on the
 * boxes showing the video's own picture (`OutputFrameCss`).
 */
export class ShotLayerStageBuilder {
  constructor(
    private readonly elementLayer: ElementCssLayerBuilder,
    private readonly transitionStyles: ShotTransitionStyleWriter,
    private readonly stageCss: ShotLayerStageCss,
    private readonly outputFrameCss: OutputFrameCss,
    private readonly followStyles: ShotFollowCameraWriter,
  ) {}

  /**
   * The stylesheet for `layers`, each styled by its record in `styles`,
   * followed as `follows` says, and for `transitions`, on a frame of
   * `frame`'s size — taken as square while not known — with the video
   * sitting in it as `outputFrame` says.
   */
  build(
    layers: ReadonlyArray<StagedShotLayer>,
    styles: ElementStyles,
    frame: VideoLayout | null,
    outputFrame: OutputFrame,
    transitions: ReadonlyArray<StagedShotTransition> = [],
    follows: ReadonlyArray<StagedShotFollow> = [],
  ): FootageStyle {
    const frameWidth = frame !== null && frame.width > 0 ? frame.width : UNKNOWN_FRAME_SIDE_PX;
    const frameHeight = frame !== null && frame.height > 0 ? frame.height : UNKNOWN_FRAME_SIDE_PX;
    const css = [
      `@layer ${CssLayer.FRAMEWORK}, ${ShotLayerCss.ASSET_LAYER}, ${ShotLayerCss.ELEMENT_LAYER}, ${ShotLayerCss.FOLLOW_LAYER}, ${ShotLayerCss.TRANSITION_LAYER};`,
      this.framework(frameWidth, frameHeight, outputFrame),
      this.assets(layers, frameWidth / frameHeight),
      this.elementLayer.build(this.stylesOf(layers, styles), ShotLayerCss.ELEMENT_LAYER),
      this.followStyles.write(follows.map((follow) => ({ selector: this.selectorOf(follow.layerId), follow }))),
      this.transitionStyles.write(transitions.map((transition) => ({ selector: this.selectorOf(transition.layerId), transition }))),
    ].filter((part) => part.length > 0).join('\n');
    return { css, frameWidth, frameHeight };
  }

  /** The framework, after the frame's shape on the stage, which it reads, and the video put in the output frame. */
  private framework(frameWidth: number, frameHeight: number, outputFrame: OutputFrame): string {
    const stage = `.${CssClass.FOOTAGE_STAGE} { ${ShotLayerCss.FRAME_LANDSCAPE}: ${frameWidth > frameHeight ? 1 : 0};`
      + ` ${ShotLayerCss.FRAME_ASPECT_RATIO}: ${Number((frameWidth / frameHeight).toFixed(6))}; }`;
    const rules = [stage, this.stageCss.framework, ...this.outputFrameCss.rules(outputFrame)];
    return `@layer ${CssLayer.FRAMEWORK} {\n${rules.join('\n')}\n}`;
  }

  /** Each box's file's shape; a file whose shape is not known takes the frame's. */
  private assets(layers: ReadonlyArray<StagedShotLayer>, frameAspectRatio: number): string {
    if (layers.length === 0) return '';
    const rules = layers.map((layer) => {
      const aspectRatio = this.validAspectRatio(layer.assetAspectRatio) ?? frameAspectRatio;
      return `${this.selectorOf(layer.layerId)} { ${ShotLayerCss.ASSET_ASPECT_RATIO}: ${Number(aspectRatio.toFixed(6))}; }`;
    });
    return `@layer ${ShotLayerCss.ASSET_LAYER} {\n${rules.join('\n')}\n}`;
  }

  private validAspectRatio(aspectRatio: number | null): number | null {
    return aspectRatio !== null && Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : null;
  }

  private stylesOf(layers: ReadonlyArray<StagedShotLayer>, styles: ElementStyles): Array<readonly [string, ElementStyle]> {
    return layers.flatMap((layer) => {
      const style = styles.get(layer.layerId);
      return style === null ? [] : [[layer.layerId, style] as const];
    });
  }

  private selectorOf(layerId: string): string {
    return `[${DataAttribute.ELEMENT_ID}="${layerId.replace(ATTRIBUTE_VALUE_SPECIAL_CHARACTERS, '\\$&')}"]`;
  }
}
