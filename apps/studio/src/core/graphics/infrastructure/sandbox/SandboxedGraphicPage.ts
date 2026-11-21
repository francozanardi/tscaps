import runtimeSource from '@core/graphics/infrastructure/sandbox/sandboxed-graphic-runtime.js?raw';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import type { GraphicPictureSize } from '@core/graphics/infrastructure/sandbox/GraphicPictureSize';

// Nothing leaves the frame and nothing comes in but what the page itself holds.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data: blob:',
  'media-src data: blob:',
].join('; ');

/**
 * The page a graphic runs in: its policy first, so nothing it holds can
 * reach the network, then the runtime that owns its clock, then the
 * fonts it is handed, then the graphic's own CSS, HTML and JavaScript,
 * in that order. The page is
 * sized to the graphic's box, which is its whole viewport. The
 * JavaScript is held as text for the runtime to run once the frame's
 * viewport measures the box: a browser may give a frame its size only
 * after its page has been parsed, and code measuring the page before
 * then would measure nothing.
 *
 * The graphic's text is written in as text: a `</script>` or a
 * `</style>` inside it cannot close the tag it sits in.
 */
export class SandboxedGraphicPage {
  /**
   * The HTML of the page that plays `document` on `stage`, with
   * `fontFaceCss` (`@font-face` rules whose files are held inline) ahead
   * of its own CSS, handing over pictures of `picture`'s pixels.
   */
  build(document: GraphicDocument, stage: GraphicStage, fontFaceCss: string, picture: GraphicPictureSize): string {
    const config = {
      widthPx: stage.widthPx,
      heightPx: stage.heightPx,
      pictureWidthPx: picture.widthPx,
      pictureHeightPx: picture.heightPx,
      fps: stage.fps,
      seed: stage.seed,
      durationSec: stage.durationSec,
      params: stage.params,
    };
    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
      `<script type="application/json" id="tscaps-graphic-config">${this.jsonInScript(config)}</script>`,
      `<script>${runtimeSource}</script>`,
      `<style>html, body { margin: 0; padding: 0; width: ${stage.widthPx}px; height: ${stage.heightPx}px; overflow: hidden; background: transparent; }</style>`,
      `<style>${this.textInTag(fontFaceCss, 'style')}</style>`,
      `<style>${this.textInTag(document.css, 'style')}</style>`,
      '</head>',
      '<body>',
      document.html,
      // Held as text: the runtime runs it once the frame's viewport is the box (see the runtime).
      `<script type="text/plain" id="tscaps-graphic-code">${this.textInTag(document.js, 'script')}</script>`,
      '</body>',
      '</html>',
    ].join('\n');
  }

  private jsonInScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
  }

  private textInTag(text: string, tag: 'script' | 'style'): string {
    return text.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
  }
}
