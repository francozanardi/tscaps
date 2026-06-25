import type { KeyboardShortcut } from '@presentation/editor/services/KeyboardShortcut';

/**
 * Formats a `KeyboardShortcut` as a human-readable label for tooltips
 * and menus, using the conventions of the current platform: ⌘/⌥/⇧
 * glyphs glued together on Apple platforms, "Ctrl"/"Alt"/"Shift" words
 * joined with "+" everywhere else.
 *
 * Platform detection runs once at construction. Treat the instance as
 * immutable for the session.
 */
export class KeyboardShortcutLabeler {

  private readonly isApplePlatform: boolean;

  constructor() {
    this.isApplePlatform = this.detectApplePlatform();
  }

  label(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.cmdOrCtrl) parts.push(this.isApplePlatform ? '⌘' : 'Ctrl');
    if (shortcut.alt) parts.push(this.isApplePlatform ? '⌥' : 'Alt');
    if (shortcut.shift) parts.push(this.isApplePlatform ? '⇧' : 'Shift');
    parts.push(shortcut.key.toUpperCase());
    return this.isApplePlatform ? parts.join('') : parts.join('+');
  }

  private detectApplePlatform(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  }
}
