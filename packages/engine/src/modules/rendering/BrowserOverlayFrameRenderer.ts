import type {
  OverlayFrame,
  OverlayFrameRenderer,
} from '@modules/rendering/OverlayFrameRenderer';

/**
 * Renders an HTML snippet as a single SVG `foreignObject` and decodes it
 * through an `<img>` so the resulting bitmap can be drawn into any 2D
 * context, including OffscreenCanvas. The SVG-image sandbox keeps the
 * downstream canvas untainted, which is what the export pipeline relies
 * on.
 */
export class BrowserOverlayFrameRenderer implements OverlayFrameRenderer {

  async render(html: string, width: number, height: number): Promise<OverlayFrame> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${height}px;overflow:hidden;">${html}</div>
  </foreignObject>
</svg>`;

    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    // decode() resolves only after the image is fully parsed AND ready to
    // paint. onload fires earlier — for SVG with foreignObject + custom
    // fonts, that often races ahead of font/style application.
    try {
      await img.decode();
    } catch (e) {
      throw new Error(
        `Overlay render failed: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }

    return {
      draw: (ctx, dx, dy, dWidth, dHeight) => ctx.drawImage(img, dx, dy, dWidth, dHeight),
    };
  }
}
