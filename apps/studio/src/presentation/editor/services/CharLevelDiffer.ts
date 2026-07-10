import type { CharEdit } from '@core/captions/domain/CharEdit';

/**
 * Common-prefix / common-suffix diff between two textarea snapshots.
 * Minimal for single-keystroke edits; for paste or select-and-retype
 * it yields one larger middle delete + insert, which is correct but
 * not provably minimal — non-minimal output only resets wordIds in
 * the affected middle, the safe direction.
 */
export class CharLevelDiffer {
  diff(oldText: string, newText: string): CharEdit[] {
    const oldLen = oldText.length;
    const newLen = newText.length;

    let prefix = 0;
    const maxPrefix = Math.min(oldLen, newLen);
    while (prefix < maxPrefix && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++;

    let suffix = 0;
    const maxSuffix = Math.min(oldLen - prefix, newLen - prefix);
    while (
      suffix < maxSuffix
      && oldText.charCodeAt(oldLen - 1 - suffix) === newText.charCodeAt(newLen - 1 - suffix)
    ) suffix++;

    const edits: CharEdit[] = [];
    if (prefix > 0) {
      edits.push({ type: 'keep', oldStart: 0, oldEnd: prefix, newStart: 0, newEnd: prefix });
    }
    const oldMidEnd = oldLen - suffix;
    const newMidEnd = newLen - suffix;
    if (oldMidEnd > prefix) {
      edits.push({ type: 'delete', oldStart: prefix, oldEnd: oldMidEnd });
    }
    if (newMidEnd > prefix) {
      edits.push({ type: 'insert', newStart: prefix, newEnd: newMidEnd });
    }
    if (suffix > 0) {
      edits.push({ type: 'keep', oldStart: oldMidEnd, oldEnd: oldLen, newStart: newMidEnd, newEnd: newLen });
    }
    return edits;
  }
}
