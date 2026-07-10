import type { BoxEdges } from '@tscaps/engine';

/**
 * Parses a CSS padding-style shorthand of length tokens (1–4) into a
 * {@link BoxEdges}, applying CSS's standard expansion rules:
 *
 *   - `"1em"`               → all four sides equal
 *   - `"1em 2em"`           → top/bottom = 1em, right/left = 2em
 *   - `"1em 2em 3em"`       → top = 1em, right/left = 2em, bottom = 3em
 *   - `"1em 2em 3em 4em"`   → top, right, bottom, left
 *
 * Length tokens are kept verbatim — any unit CSS accepts (`em`,
 * `px`, `cqh`, `%`, …) flows through unchanged. Throws on a token
 * count outside 1–4 so authoring errors surface at load time
 * instead of degrading silently at render time.
 */
export class BoxEdgesShorthandParser {

  parse(shorthand: string): BoxEdges {
    const tokens = shorthand.trim().split(/\s+/);
    if (tokens.length < 1 || tokens.length > 4 || tokens[0] === '') {
      throw new Error(`Invalid shorthand: "${shorthand}". Expected 1 to 4 length tokens, e.g. "0.5em" or "1em 2em".`);
    }
    return this.expand(tokens);
  }

  private expand(tokens: string[]): BoxEdges {
    switch (tokens.length) {
      case 1: {
        const all = tokens[0]!;
        return { top: all, right: all, bottom: all, left: all };
      }
      case 2: {
        const [vertical, horizontal] = tokens as [string, string];
        return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
      }
      case 3: {
        const [top, horizontal, bottom] = tokens as [string, string, string];
        return { top, right: horizontal, bottom, left: horizontal };
      }
      case 4: {
        const [top, right, bottom, left] = tokens as [string, string, string, string];
        return { top, right, bottom, left };
      }
      default:
        throw new Error(`Unreachable: shorthand had ${tokens.length} tokens after validation.`);
    }
  }
}
