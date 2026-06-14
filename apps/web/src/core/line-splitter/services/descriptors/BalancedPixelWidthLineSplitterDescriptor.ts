import { BalancedPixelWidthLineSplitter, DomProbeCanvasTextMeasurer, type LineSplitter } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { LineSplitterDescriptor, LineSplitterContext } from '@core/line-splitter/domain/LineSplitterDescriptor';
import type { BalancedPixelWidthLineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

export class BalancedPixelWidthLineSplitterDescriptor
  implements LineSplitterDescriptor<BalancedPixelWidthLineSplitterConfig>
{
  readonly type = 'balanced-pixel-width' as const;

  readonly defaultConfig: BalancedPixelWidthLineSplitterConfig = {
    type: 'balanced-pixel-width',
    maxLines: 2,
    minLines: 1,
    maxWidthRatio: 0.8,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'maxLines', label: 'Max lines', type: 'integer', default: 2, min: 1, max: 8 },
    { id: 'minLines', label: 'Min lines', type: 'integer', default: 1, min: 1, max: 8 },
    { id: 'maxWidthRatio', label: 'Max line width', type: 'float', default: 0.8, min: 0.3, max: 1.0, step: 0.01 },
  ];

  build(config: BalancedPixelWidthLineSplitterConfig, context: LineSplitterContext): LineSplitter {
    const measurer = new DomProbeCanvasTextMeasurer({
      css: context.css,
      cssVars: context.cssVars,
      containerWidth: context.videoWidth,
      containerHeight: context.videoHeight,
    });
    return new BalancedPixelWidthLineSplitter(
      {
        maxLines: config.maxLines,
        minLines: config.minLines,
        maxWidth: Math.round(context.videoWidth * config.maxWidthRatio),
      },
      measurer,
    );
  }
}
