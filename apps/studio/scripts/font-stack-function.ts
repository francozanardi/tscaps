import { SassString, type Value } from 'sass';
import type { TemplateFontStackRegistry } from '@core/templates/services/fonts/TemplateFontStackRegistry';

/** Sass callback backing font-stack(); registration and the CSS reference are emitted together. */
export function fontStackFunction(registry: TemplateFontStackRegistry) {
  return (args: Value[]): Value => {
    const variable = registry.declare(args[0]!.assertString().text);
    return new SassString(`var(${variable})`, { quotes: false });
  };
}
