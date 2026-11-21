import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';

/**
 * A preview proxy as its encode hands it over, with what the encode
 * noticed while reading every frame of the source. A proxy read back
 * from storage is a plain {@link PreviewProxy}: what was noticed is kept
 * with the project, not with the proxy.
 */
export interface GeneratedPreviewProxy extends PreviewProxy {
  /**
   * Where the source's picture changes abruptly, in source seconds,
   * ascending; `null` where the encode could not look.
   */
  readonly pictureChangesSec: ReadonlyArray<number> | null;
}
