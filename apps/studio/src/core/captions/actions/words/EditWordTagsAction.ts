import { DocumentEditor, Tag } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

/**
 * Replaces a word's semantic tags with the given set of tag names.
 * The structure tags and every other word field are preserved — only
 * `semanticTags` changes. Coalesces successive toggles on the same
 * word into one undo entry so flipping a couple of tags in a row
 * does not flood the history stack. Effects are reapplied so time-
 * shaping passes (e.g. gap-free padding) re-stamp against the post-
 * edit segment.
 */
export class EditWordTagsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(wordId: string, tagNames: ReadonlySet<string>): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return;

    const pos = docEditor.findWordById(document, wordId);
    if (!pos) return;

    const original = document.getSegments()[pos.segIdx]!.lines[pos.lineIdx]!.words[pos.wordIdx]!;
    const nextSemanticTags = this.buildSemanticTagSet(tagNames);
    if (this.tagSetsAreEqual(original.semanticTags, nextSemanticTags)) return;

    const replacement = original.with({ semanticTags: nextSemanticTags });
    const edited = docEditor.replaceWordAt(
      document,
      pos.segIdx,
      pos.lineIdx,
      pos.wordIdx,
      [replacement],
    );
    const nextDocument = this.deriver.reapplyEffects(edited, snap.sheets, snap.video.duration, snap.decorationOverrides);

    this.store.commit('word-tags:' + wordId);
    this.store.patch({ document: nextDocument });
  }

  private buildSemanticTagSet(tagNames: ReadonlySet<string>): ReadonlySet<Tag> {
    const tags = new Set<Tag>();
    for (const name of tagNames) tags.add(Tag.of(name));
    return tags;
  }

  private tagSetsAreEqual(left: ReadonlySet<Tag>, right: ReadonlySet<Tag>): boolean {
    if (left.size !== right.size) return false;
    const rightNames = new Set<string>();
    for (const tag of right) rightNames.add(tag.name);
    for (const tag of left) {
      if (!rightNames.has(tag.name)) return false;
    }
    return true;
  }
}
