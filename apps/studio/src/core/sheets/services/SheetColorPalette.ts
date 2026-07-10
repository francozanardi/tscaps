/**
 * Predefined palette of accent colors used to visually distinguish sheets in
 * the captions UI. The first not-yet-used color is picked when creating a
 * sheet; if every color is taken, we wrap around to the start.
 */
const PALETTE: readonly string[] = [
  '#7CB7FF', // blue
  '#9F86F2', // violet
  '#F08B6E', // coral
  '#5BC9A6', // teal
  '#EBB85C', // amber
  '#E582B6', // pink
  '#84A98C', // sage
  '#C56EE0', // magenta
];

export class SheetColorPalette {
  pickColor(usedColors: ReadonlyArray<string | null>): string {
    const taken = new Set(usedColors.filter((c): c is string => c !== null));
    for (const color of PALETTE) {
      if (!taken.has(color)) return color;
    }
    return PALETTE[usedColors.length % PALETTE.length]!;
  }
}
