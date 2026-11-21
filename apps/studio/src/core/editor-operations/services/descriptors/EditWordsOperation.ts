import { z } from 'zod';
import type { Word } from '@tscaps/engine';
import type { EditWordTagsAction } from '@core/captions/actions/words/EditWordTagsAction';
import type { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { WordTagLookChecker } from '@core/editor-operations/services/WordTagLookChecker';
import { TAG_METADATA, WORD_TAG_NAMES } from '@core/tagging/domain/TagName';

const MAX_EDITS = 50;
const MAX_TEXT_CHARS = 200;
const HAND_SET_TAGS: ReadonlySet<string> = new Set(WORD_TAG_NAMES);

/** One entry of the input, pointed at the word it changes. */
interface WordEdit {
  readonly ref: string;
  readonly wordId: string;
  readonly text: string | undefined;
  readonly tags: ReadonlyArray<string> | undefined;
}

/** A word whose text held spaces, and the words it became: itself first, then the new ones. */
interface WordSplit {
  readonly word: string;
  readonly into: ReadonlyArray<string>;
}

/**
 * `edit_words`: changes the text and the hand-set tags of several words
 * in one call. Every entry is checked before anything is written, so a
 * call naming a word that is gone changes nothing. A text or a set of
 * tags equal to what the word already has is not written again.
 */
export class EditWordsOperation implements EditorOperation {
  readonly name = 'edit_words';
  readonly effect = 'edit';
  readonly description = [
    `Change the text and/or the tags of up to ${MAX_EDITS} words at once; nothing is changed when any ref is gone.`,
    '`text` replaces what the word says (its timing stays). Text with spaces splits it into several words sharing its time: the first keeps the ref, the others get new refs, answered in `split`.',
    '`tags` REPLACES the word\'s hand-set tags with exactly that list ([] removes them); templates paint tagged words differently, e.g. in an accent colour.',
    'Tags the analysis gives to whole phrases (peak, hook, cta, superlative, stat) are kept. Answers the refs of the words that changed.',
  ].join(' ');

  private readonly input = new OperationInput({
    edits: z.array(z.strictObject({
      word: z.string().describe('The word, as a ref: word:<id>.'),
      text: z.string().max(MAX_TEXT_CHARS).optional().describe('What the word says from now on. Not empty.'),
      tags: z.array(z.enum(WORD_TAG_NAMES)).max(WORD_TAG_NAMES.length).optional()
        .describe(`The word's complete set of hand-set tags. ${WORD_TAG_NAMES.map((name) => `${name}: ${TAG_METADATA[name].description}`).join(' ')}`),
    })).min(1).max(MAX_EDITS).describe('One entry per word, each with text, tags or both.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly editWordText: EditWordTextAction,
    private readonly editWordTags: EditWordTagsAction,
    private readonly tagLooks: WordTagLookChecker,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const resolved = checked.value.edits.map((edit) => this.resolved(edit));
    const edits = resolved.flatMap((each) => (each.ok ? [each.value] : []));
    const problems = [...resolved.flatMap((each) => (each.ok ? [] : [each.problem])), ...this.namedTwice(edits)];
    if (problems.length > 0) return this.refused(problems);

    const changed: string[] = [];
    const splits: WordSplit[] = [];
    for (const edit of edits) {
      // Tags go first: a text that splits the word copies its tags onto
      // every part, so "New York" tagged entity tags both words.
      const retagged = this.retagged(edit);
      const split = this.retexted(edit);
      if (retagged || split !== null) changed.push(edit.ref);
      if (split !== null && split.into.length > 1) splits.push(split);
    }
    const unstyled = edits.flatMap((edit) => (edit.tags === undefined ? [] : this.tagLooks.warningsFor(edit.wordId, edit.ref, edit.tags)));
    return {
      ok: true,
      output: splits.length > 0 ? { changed, split: splits } : { changed },
      problems: [...splits.map((split) => this.splitWarning(split)), ...unstyled],
    };
  }

  private resolved(edit: { readonly word: string; readonly text?: string | undefined; readonly tags?: ReadonlyArray<string> | undefined }): ResolvedRef<WordEdit> {
    const word = this.captions.resolve(edit.word, ['word']);
    if (!word.ok) return word;
    if (edit.text === undefined && edit.tags === undefined) {
      return this.problem(edit.word, `The entry for ${edit.word} changes nothing: give it text, tags or both.`);
    }
    if (edit.text !== undefined && edit.text.trim() === '') {
      return this.problem(edit.word, `The text for ${edit.word} is empty; a word needs some text.`);
    }
    return { ok: true, value: { ref: edit.word, wordId: word.value.id, text: edit.text, tags: edit.tags } };
  }

  private namedTwice(edits: ReadonlyArray<WordEdit>): OperationProblem[] {
    const seen = new Set<string>();
    const problems: OperationProblem[] = [];
    for (const edit of edits) {
      if (seen.has(edit.wordId)) {
        problems.push({ severity: 'error', ref: edit.ref, message: `${edit.ref} is named twice; put its text and tags in one entry.` });
      }
      seen.add(edit.wordId);
    }
    return problems;
  }

  /** Writes the edit's tags beside the tags no hand sets, when that changes the word's. Whether it did. */
  private retagged(edit: WordEdit): boolean {
    if (edit.tags === undefined) return false;
    const word = this.wordNamed(edit.wordId);
    if (word === null) return false;
    const current = new Set([...word.semanticTags].map((tag) => tag.name));
    const next = new Set([...edit.tags, ...[...current].filter((name) => !HAND_SET_TAGS.has(name))]);
    if (next.size === current.size && [...current].every((name) => next.has(name))) return false;
    this.editWordTags.execute(edit.wordId, next);
    return true;
  }

  /** Writes the edit's text when it differs from the word's. The words it became, or null when nothing was written. */
  private retexted(edit: WordEdit): WordSplit | null {
    if (edit.text === undefined) return null;
    const word = this.wordNamed(edit.wordId);
    if (word === null || word.text === edit.text.trim()) return null;
    const before = this.wordIds();
    this.editWordText.execute(edit.wordId, edit.text);
    const added = [...this.wordIds()].filter((id) => !before.has(id));
    return { word: edit.ref, into: [edit.ref, ...added.map((id) => this.parser.formatOf('word', id))] };
  }

  private splitWarning(split: WordSplit): OperationProblem {
    return {
      severity: 'warning',
      ref: split.word,
      message: `The text had spaces, so ${split.word} became ${split.into.length} words: ${split.into.join(', ')}. Other words keep their refs; the scene holding them can be re-split at the next layout, so read segment refs again before using them.`,
    };
  }

  private wordNamed(wordId: string): Word | null {
    return this.store.snapshot().document?.getWords().find((word) => word.id === wordId) ?? null;
  }

  private wordIds(): ReadonlySet<string> {
    return new Set(this.store.snapshot().document?.getWords().map((word) => word.id) ?? []);
  }

  private problem(ref: string, message: string): ResolvedRef<WordEdit> {
    return { ok: false, problem: { severity: 'error', message, ref } };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
