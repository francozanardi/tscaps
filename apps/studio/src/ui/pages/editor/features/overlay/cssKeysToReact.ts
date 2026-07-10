/**
 * Converts a CSS property map with kebab-case keys (the shape produced by
 * `WordStyleOverrideRegistry.buildCss` / `SegmentOverrides.buildCss`, meant
 * to be concatenated into a raw `style="..."` attribute by the engine
 * renderer) into the camelCase keys React expects on its inline `style` prop.
 *
 * Custom properties (`--foo`) and already-camelCase keys are passed through.
 */
export function cssKeysToReact(
  map: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    out[k.startsWith('--') || !k.includes('-') ? k : kebabToCamel(k)] = v;
  }
  return out;
}

function kebabToCamel(k: string): string {
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
