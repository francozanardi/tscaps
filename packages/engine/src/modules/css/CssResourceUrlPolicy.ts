/**
 * Decides which `url()` references in a stylesheet are worth fetching
 * before rasterization.
 *
 * Rasterizing goes through an `<img>` decoding an SVG, and a browser
 * refuses to load external resources for an SVG used as an image. So
 * anything the picture needs has to be inlined as a `data:` URI first,
 * and inlining means fetching. That fetch is made by whoever is
 * rendering, against whatever address the stylesheet names — which is
 * a decision about the host, not about the picture, and therefore not
 * one the renderer should make for every host alike.
 */
export interface CssResourceUrlPolicy {
  allows(url: string): boolean;
}
