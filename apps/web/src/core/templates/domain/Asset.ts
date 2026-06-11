/**
 * A visual asset a template can paint with. Built-in assets ship in
 * the app bundle; user assets are uploaded files. `source` discriminates
 * the two so consumers that need different affordances per origin (e.g.
 * destructive operations) can branch on it; URL resolution itself is
 * uniform across both.
 */
export interface Asset {
  readonly id: string;
  readonly url: string;
  readonly source: 'builtin' | 'user';
}
