import type { FontMetrics } from '@core/fonts/domain/FontMetrics';

/**
 * Reports the vertical box a registered face gives a line.
 *
 * Answers `null` for a face whose metrics cannot be read yet — one the
 * page has not finished loading, most of all — because the alternative
 * is reporting the metrics of whatever the device stood in for it, which
 * differs from machine to machine and would be baked into the CSS as if
 * it were the face's own.
 */
export interface FontMetricsReader {
  read(family: string): FontMetrics | null;
}
