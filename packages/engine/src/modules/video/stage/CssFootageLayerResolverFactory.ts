import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageStyle } from '@modules/video/FootageStyle';
import { CssFootageLayerResolver } from '@modules/video/stage/CssFootageLayerResolver';
import type { FootageLayerClockFactory } from '@modules/video/stage/FootageLayerClockFactory';
import type { FootageLayerResolver } from '@modules/video/stage/FootageLayerResolver';
import type { FootageLayerResolverFactory } from '@modules/video/stage/FootageLayerResolverFactory';
import type { FootageLayerStateReader } from '@modules/video/stage/FootageLayerStateReader';
import type { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';

/**
 * Opens a {@link CssFootageLayerResolver}: each resolver keeps a stage of
 * its own in the document, so two of them — say a preview and a render
 * — never disturb each other, and a clock of its own, picked for its
 * stylesheet.
 */
export class CssFootageLayerResolverFactory implements FootageLayerResolverFactory {
  constructor(
    private readonly reader: FootageLayerStateReader,
    private readonly baseline: FootageStageBaselineCss,
    private readonly clocks: FootageLayerClockFactory,
  ) {}

  open(layers: ReadonlyArray<FootageLayer>, style: FootageStyle): FootageLayerResolver {
    return new CssFootageLayerResolver(layers, style, this.reader, this.baseline, this.clocks.open(style));
  }
}
