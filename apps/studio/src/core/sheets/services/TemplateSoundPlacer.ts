import type { Document, Segment, TagConditionParser, Word } from '@tscaps/engine';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateSound } from '@core/templates/domain/definition/TemplateSound';

/**
 * Places the sounds a template plays on its words, the way a graphic
 * preset places its own: as ordinary effects, each anchored to the start
 * of the word it marks, which the person can then move, change or
 * remove.
 *
 * A sheet that changed template loses the sounds its previous template
 * placed on its words — an effect on one of those words playing one of
 * that template's sounds — and gets its new template's, on every word of
 * its visible captions the sound's expression holds for. A sound of the
 * person's own on the same word, with the same file, reads as the
 * template's and goes with it.
 *
 * `document` is the one laid out under the new templates, so a sound
 * that only plays on a word alone in its caption follows the new cuts.
 * Its words are the Original track's, since a word anchor names one.
 */
export class TemplateSoundPlacer {
  constructor(
    private readonly clipDefaults: AudioClipDefaults,
    private readonly tagConditionParser: TagConditionParser,
  ) {}

  /** `mix` with each changed sheet's sounds made its new template's; the same mix where nothing changes. */
  mixFor(mix: AudioMix, document: Document, before: ReadonlyArray<Sheet>, after: ReadonlyArray<Sheet>): AudioMix {
    let next = mix;
    for (const sheet of after) {
      const previous = before.find((candidate) => candidate.id === sheet.id);
      if (!previous || previous.template === sheet.template) continue;
      const segments = this.segmentsUnder(document, sheet.id);
      next = this.withSoundsAdded(this.withSoundsRemoved(next, segments, previous.template), segments, sheet.template);
    }
    return next;
  }

  private segmentsUnder(document: Document, sheetId: string): Segment[] {
    return document.sections.filter((section) => section.kind === sheetId).flatMap((section) => section.segments);
  }

  private withSoundsRemoved(mix: AudioMix, segments: ReadonlyArray<Segment>, template: Template): AudioMix {
    if (template.sounds.length === 0) return mix;
    const soundIds = new Set(template.sounds.map((sound) => sound.soundId));
    const wordIds = new Set(segments.flatMap((segment) => segment.getWords().map((word) => word.id)));
    const placed = mix.clips().filter((clip) => this.isPlacedBy(clip, soundIds, wordIds));
    return placed.length === 0 ? mix : mix.withoutClips(placed.map((clip) => clip.id));
  }

  private isPlacedBy(clip: AudioClip, soundIds: ReadonlySet<string>, wordIds: ReadonlySet<string>): boolean {
    const { anchor } = clip.start;
    return clip.role === 'effect'
      && clip.source.kind === 'builtin'
      && soundIds.has(clip.source.soundId)
      && anchor.kind === 'word'
      && wordIds.has(anchor.wordId);
  }

  private withSoundsAdded(mix: AudioMix, segments: ReadonlyArray<Segment>, template: Template): AudioMix {
    return template.sounds.reduce(
      (next, sound) => this.wordsMarkedBy(sound, segments).reduce((withWord, word) => withWord.withClipAdded(this.clipOn(word, sound)), next),
      mix,
    );
  }

  /**
   * The words of the visible captions `sound` plays on, in reading order,
   * less every one said sooner than `minGapSec` after the last one kept.
   */
  private wordsMarkedBy(sound: TemplateSound, segments: ReadonlyArray<Segment>): Word[] {
    const condition = this.tagConditionParser.parse(sound.when);
    const marked = segments
      .filter((segment) => !segment.hidden)
      .map((segment) => segment.getWords())
      .filter((words) => !sound.alone || words.length === 1)
      .flat()
      .filter((word) => condition.evaluate(word.semanticTags));
    return this.spacedApart(marked, sound.minGapSec);
  }

  private spacedApart(words: ReadonlyArray<Word>, minGapSec: number): Word[] {
    const kept: Word[] = [];
    for (const word of words) {
      const last = kept[kept.length - 1];
      if (!last || word.time.start - last.time.start >= minGapSec) kept.push(word);
    }
    return kept;
  }

  private clipOn(word: Word, sound: TemplateSound): AudioClip {
    return this.clipDefaults.clipFrom(crypto.randomUUID(), {
      role: 'effect',
      source: { kind: 'builtin', soundId: sound.soundId },
      start: { anchor: { kind: 'word', wordId: word.id, edge: 'start' }, offsetSec: sound.offsetSec },
      volume: sound.volume,
    });
  }
}
