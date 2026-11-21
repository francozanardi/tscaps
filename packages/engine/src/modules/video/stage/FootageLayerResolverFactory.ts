import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageStyle } from '@modules/video/FootageStyle';
import type { FootageLayerResolver } from '@modules/video/stage/FootageLayerResolver';

/** Opens a {@link FootageLayerResolver} for a set of layers and the stylesheet that styles them. */
export interface FootageLayerResolverFactory {
  /** `layers` in output time, bottom to top. The resolver is the caller's to dispose. */
  open(layers: ReadonlyArray<FootageLayer>, style: FootageStyle): FootageLayerResolver;
}
