import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';

const HTML_ATTR_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * Serializes inline-style maps into the `style="..."` attribute body
 * the renderer embeds in each element, dropping CSS custom properties
 * the consuming stylesheet never reads so each rendered SVG carries
 * only the bytes its rules actually consume.
 *
 * Constructed once per prepared style with the set of custom-property
 * names referenced anywhere in that style's CSS. CSS properties (non
 * `--…`) always pass through; only custom properties are filtered.
 */
export class InlineStyleEmitter {

  constructor(private readonly usedCssVars: ReadonlySet<string>) {}

  /**
   * Serializes `vars` prefixed with the engine's animation timing
   * primitives (`animation-play-state: paused` and
   * `animation-fill-mode: both`) so the consuming element renders in
   * lockstep with the per-frame `currentTime` instead of free-running.
   */
  serializeAnimatedVars(vars: Record<string, string>): string {
    return 'animation-play-state: paused; animation-fill-mode: both; ' + this.serializeStyles(vars);
  }

  /** Serializes `styles` as a CSS attribute body, filtering unused custom properties. */
  serializeStyles(styles: Readonly<InlineStyleMap> | undefined): string {
    if (!styles) return '';
    let result = '';
    for (const [property, value] of Object.entries(styles)) {
      if (this.isCustomProperty(property) && !this.usedCssVars.has(property)) continue;
      result += `${property}: ${this.escapeAttributeValue(value)}; `;
    }
    return result;
  }

  private isCustomProperty(propertyName: string): boolean {
    return propertyName.startsWith('--');
  }

  // A bare `"` inside an attribute value (e.g. a user-typed caption)
  // would close the surrounding `style="..."` attribute and leave the
  // HTML malformed.
  private escapeAttributeValue(value: string): string {
    return value.replace(/[&"<>]/g, (c) => HTML_ATTR_ENTITIES[c]!);
  }
}
