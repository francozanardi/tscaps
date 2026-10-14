/**
 * Where a shortcut can fire, which decides which shortcuts may share a
 * chord. `'app'` is everywhere; `'editor'` is anywhere a project is open;
 * `'transcript'` and `'timeline'` are the two editing modes, and since
 * only one of them is ever on screen, a chord can mean one thing in each.
 */
export type ShortcutScope = 'app' | 'editor' | 'transcript' | 'timeline';
