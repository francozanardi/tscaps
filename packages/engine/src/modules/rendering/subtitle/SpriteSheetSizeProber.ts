const NUMBER_OF_TILES_TO_TEST = [1, 2, 4, 6, 8, 10, 12, 15, 18, 21, 25, 30];

// 10 frames at 1080×1920 ≈ 80 MB of pixel buffer.
// At 4K the same budget admits only ~2 tiles per batch.
const DEFAULT_MAX_BUFFER_PIXELS = 10 * 1080 * 1920;

/**
 * Empirically probes the maximum number of subtitle tiles that fit
 * into a single sprite sheet at the given output dimensions without
 * blowing past the host's 2D-canvas raster cap or the configured
 * pixel budget. No public browser API surfaces the raster cap
 * directly, and the reported WebGL limits bear no stable relation to
 * what `img.decode` / `drawImage` accept. Some hosts decode oversize
 * SVGs but blank the far edges of the raster; the probe reads back a
 * corner pixel to detect that.
 */
export class SpriteSheetSizeProber {

  constructor(private readonly maxBufferPixels: number = DEFAULT_MAX_BUFFER_PIXELS) {}

  async probe(width: number, height: number): Promise<number> {
    try {
      let lastPassing = 1;
      for (const numberOfTiles of NUMBER_OF_TILES_TO_TEST) {
        const isPortrait = width < height;
        const scaledWidth = isPortrait ? width * numberOfTiles : width;
        const scaledHeight = isPortrait ? height : height * numberOfTiles;
        if (scaledWidth * scaledHeight > this.maxBufferPixels) return lastPassing;
        if (!(await this.testTileSize(scaledWidth, scaledHeight))) return lastPassing;
        lastPassing = numberOfTiles;
      }
      return lastPassing;
    } catch {
      return 1;
    }
  }

  private async testTileSize(width: number, height: number): Promise<boolean> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="green"/><rect x="${width - 2}" y="${height - 2}" width="2" height="2" fill="red"/></svg>`;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    try {
      await img.decode();
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(width - 1, height - 1, 1, 1).data;
      return px[0]! > 200 && px[1]! < 80 && px[2]! < 80 && px[3]! > 200;
    } catch {
      return false;
    }
  }
}
