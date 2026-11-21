/**
 * Makes a small poster of a picture file — a still, or a GIF's first
 * frame — so a grid of them never holds full-size pictures decoded.
 *
 * Posters already made are answered from memory for as long as the
 * file itself is held.
 */
export class StillPosterSampler {
  private readonly posters = new WeakMap<Blob, Promise<string>>();

  constructor(private readonly maxWidth: number = 200) {}

  /**
   * A PNG data URL of `source`, at most `maxWidth` wide, keeping its
   * shape. `widthPx` is the picture's own width, null when it is not
   * known, which lets the browser decode it straight to the poster's
   * size. Rejects when the browser cannot read the picture.
   */
  posterOf(source: Blob, widthPx: number | null): Promise<string> {
    const known = this.posters.get(source);
    if (known) return known;
    const poster = this.draw(source, widthPx);
    this.posters.set(source, poster);
    // A failed read is not kept, so asking again tries again.
    poster.catch(() => this.posters.delete(source));
    return poster;
  }

  private async draw(source: Blob, widthPx: number | null): Promise<string> {
    const knownWidth = widthPx !== null && widthPx > 0 ? widthPx : this.maxWidth;
    const resizeWidth = Math.max(1, Math.round(Math.min(this.maxWidth, knownWidth)));
    const picture = await createImageBitmap(source, { resizeWidth, resizeQuality: 'medium' });
    const { width, height } = picture;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context unavailable');
      context.drawImage(picture, 0, 0, width, height);
      // PNG, not JPEG: a picture with transparent parts keeps them.
      return canvas.toDataURL('image/png');
    } finally {
      picture.close();
    }
  }
}
