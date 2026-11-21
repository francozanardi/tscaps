import { z } from 'zod';
import type { Decoration, WordSplitter } from '@tscaps/engine';
import type { AddDecorationAction } from '@core/captions/actions/decorations/AddDecorationAction';
import type { ClearDecorationAction } from '@core/captions/actions/decorations/ClearDecorationAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShownDecorationReader } from '@core/editor-operations/services/ShownDecorationReader';

const MAX_GRAPHEMES = 2;
// What every emoji holds at least one of: a pictograph, a flag's regional
// indicator, or a keycap's combining mark.
const EMOJI_CODE_POINT = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

/**
 * `set_emoji`: puts one emoji on a word, replacing the one it had, or
 * takes the word's emoji away. The emoji is the person's own: it shows
 * whether or not automatic emojis are on, and its caption shows it in
 * place of the one automatic emojis give it. The answer names the
 * automatic emoji another word of the caption stopped showing, or, once
 * the person's own is taken away, the one it shows again. An emoji the
 * word already shows as the person's own is not written again, and
 * taking away an emoji that was already removed changes nothing.
 *
 * Setting the very emoji a word holds as a suggestion the layout leaves
 * out of a caption that shows another is refused. After a template
 * switch the model did it unasked, to bring back the emojis the new
 * layout leaves out, even knowing why the layout gives one: in place of
 * the layout's own, or beside them, by setting those too. Another glyph,
 * or the caption's own taken away first, still goes through.
 */
export class SetEmojiOperation implements EditorOperation {
  readonly name = 'set_emoji';
  readonly effect = 'edit';
  readonly description = [
    'Put one emoji on a word, replacing the emoji it had, or remove it with `emoji: null`.',
    'The emoji shows while its word\'s scene does, placed as the sheet\'s emoji setting says (by default below the scene), whether or not the sheet\'s automatic emojis are on: it is the person\'s own, and its scene shows it in place of the one automatic emojis give the scene, not beside it.',
    'Answers the emoji\'s ref (decoration:<id>), which set_element_css and set_element_animation can style.',
  ].join(' ');

  private readonly input = new OperationInput({
    word: z.string().describe('The word, as a ref: word:<id>.'),
    emoji: z.string().max(32).nullable().describe('One emoji (at most two side by side, e.g. "🔥" or "🎉✨"), or null to remove the word\'s emoji.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly graphemes: WordSplitter,
    private readonly addDecoration: AddDecorationAction,
    private readonly clearDecoration: ClearDecorationAction,
    private readonly shown: ShownDecorationReader,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused([...checked.problems]);
    const { word, emoji } = checked.value;
    const resolved = this.captions.resolve(word, ['word']);
    if (!resolved.ok) return this.refused([resolved.problem]);
    if (emoji === null) return this.removed(word, resolved.value.id);
    const glyph = emoji.trim();
    const wrong = this.glyphProblem(glyph);
    if (wrong !== null) return this.refused([{ severity: 'error', message: wrong, ref: word }]);
    const crowded = this.crowdingOf(resolved.value.id, glyph);
    if (crowded !== null) {
      return this.refused([{
        severity: 'error',
        ref: word,
        message: `${word} already holds ${glyph}, a suggestion this layout leaves out: its caption's emoji is ${crowded}, one per caption, so it was not set.`,
      }]);
    }
    const shownBefore = this.shown.shownIds(this.store.snapshot());
    const decorationId = this.placed(resolved.value.id, glyph);
    const displaced = this.otherEmojiOf(resolved.value.id, shownBefore, false);
    return {
      ok: true,
      output: { word, emoji: glyph, decoration: this.parser.formatOf('decoration', decorationId), ...(displaced === null ? {} : { insteadOf: displaced }) },
      problems: [],
    };
  }

  /** Puts `glyph` on the word unless it already shows it as the person's own pick. The decoration's id. */
  private placed(wordId: string, glyph: string): string {
    const current = this.decorationOf(wordId);
    if (current !== null && current.glyph === glyph && this.isOwnPick(current.id)) return current.id;
    return this.addDecoration.execute(wordId, glyph);
  }

  /**
   * The emoji the word's caption shows instead of `glyph`, where the word
   * holds `glyph` as a suggestion the layout leaves out, one that shows
   * neither now nor once automatic emojis are on; null otherwise.
   */
  private crowdingOf(wordId: string, glyph: string): string | null {
    const current = this.decorationOf(wordId);
    if (current === null || current.glyph !== glyph || this.isOwnPick(current.id)) return null;
    const state = this.store.snapshot();
    const emojis = this.shown.emojisOf(state);
    const given = (id: string) => emojis.shown.has(id) || emojis.suggested.has(id);
    if (given(current.id)) return null;
    const caption = state.document?.getSegments().find((segment) => segment.getWords().some((word) => word.id === wordId));
    const other = caption?.getWords().find((word) => word.decoration !== null && given(word.decoration.id));
    return other?.decoration?.glyph ?? null;
  }

  private removed(word: string, wordId: string): OperationResult {
    const current = this.decorationOf(wordId);
    const shownBefore = this.shown.shownIds(this.store.snapshot());
    if (current !== null) this.clearDecoration.execute(current.id);
    const restored = this.otherEmojiOf(wordId, shownBefore, true);
    return { ok: true, output: { word, emoji: null, removed: current !== null, ...(restored === null ? {} : { inItsPlace: restored }) }, problems: [] };
  }

  /**
   * The emoji on another word of `wordId`'s caption that shows now, when
   * `showsNow`, or stopped showing, when not, against `shownBefore`: the
   * automatic emoji the person's own took the place of or gave it back
   * to. Null where none changed.
   */
  private otherEmojiOf(wordId: string, shownBefore: ReadonlySet<string>, showsNow: boolean): { emoji: string; word: string } | null {
    const state = this.store.snapshot();
    const shown = this.shown.shownIds(state);
    const caption = state.document?.getSegments().find((segment) => segment.getWords().some((word) => word.id === wordId));
    const flipped = (id: string) => shown.has(id) === showsNow && shownBefore.has(id) !== showsNow;
    const other = caption?.getWords().find((word) => word.id !== wordId && word.decoration !== null && flipped(word.decoration.id));
    return other?.decoration ? { emoji: other.decoration.glyph, word: this.parser.formatOf('word', other.id) } : null;
  }

  /** Why `glyph` is not one or two emojis, or null when it is. */
  private glyphProblem(glyph: string): string | null {
    const clusters = this.graphemes.split(glyph);
    if (clusters.length === 0 || clusters.length > MAX_GRAPHEMES) {
      return `"${glyph}" is not one emoji: give one emoji, or at most ${MAX_GRAPHEMES} side by side.`;
    }
    if (!clusters.every((cluster) => EMOJI_CODE_POINT.test(cluster))) {
      return `"${glyph}" is not an emoji: only emojis can ride a word.`;
    }
    return null;
  }

  /**
   * The emoji the word carries, or null. One removed earlier stays in
   * the captions as a decoration marked removed, and counts as none.
   */
  private decorationOf(wordId: string): Decoration | null {
    const state = this.store.snapshot();
    const decoration = state.document?.getWords().find((word) => word.id === wordId)?.decoration ?? null;
    if (decoration === null || state.decorationOverrides.get(decoration.id).removed === true) return null;
    return decoration;
  }

  /**
   * Whether the person picked or changed the emoji, which keeps it on
   * screen. One the transcription picked shows only while the sheet's
   * automatic emojis are on.
   */
  private isOwnPick(decorationId: string): boolean {
    const override = this.store.snapshot().decorationOverrides.get(decorationId);
    return override.source === 'user' || override.glyph !== undefined;
  }

  private refused(problems: OperationProblem[]): OperationResult {
    return { ok: false, output: null, problems };
  }
}
