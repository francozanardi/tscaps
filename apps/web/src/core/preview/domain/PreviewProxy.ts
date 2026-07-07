/**
 * Re-encoded version of a source video that the preview engine
 * loads instead of the original. The encoder normalizes codec
 * (H.264) and downsizes the long edge so the editor never has to
 * decode 4K frames or HEVC streams the browser cannot accelerate.
 *
 * The original file is preserved separately for export — the
 * proxy never crosses the boundary into the rendered output.
 */
export interface PreviewProxy {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}
