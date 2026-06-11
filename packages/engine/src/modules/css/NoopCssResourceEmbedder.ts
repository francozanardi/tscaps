import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';

/**
 * `CssResourceEmbedder` that returns the input CSS verbatim and
 * strips every `@font-face` rule along the way. Referenced font
 * families in the stripped CSS resolve against whatever the host
 * already has loaded, with the platform default as the ultimate
 * fallback.
 */
export class NoopCssResourceEmbedder implements CssResourceEmbedder {
  async embed(css: string): Promise<string> {
    return css.replace(/@font-face\s*\{[^}]*\}/g, '');
  }
}
