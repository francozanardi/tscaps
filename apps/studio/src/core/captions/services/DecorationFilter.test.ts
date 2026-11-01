import { describe, expect, it } from 'vitest';
import { Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import { Sheet } from '@core/sheets/domain/Sheet';
import { EMOJI_GAP_DEFAULT, EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';

/**
 * `hasVisibleDecoration` has to agree with what `filterDocument` leaves
 * standing: a decoration the reader hid is one no render will paint.
 *
 * A caption shows at most one of the emojis transcription picked, the
 * last; what the reader added or edited shows besides.
 */

const TEMPLATE = { styleControls: [], variants: [], metadata: { id: 't' }, effectConfigs: [] } as unknown as Template;

function sheet(id: string, emojiEnabled: boolean): Sheet {
  return Sheet
    .fromTemplate(id, id, null, TEMPLATE, 'ltr')
    .with({
      effectConfigs: [{
        type: 'emoji',
        enabled: emojiEnabled,
        placement: EMOJI_PLACEMENT_DEFAULT,
        size: EMOJI_SIZE_DEFAULT,
        gap: EMOJI_GAP_DEFAULT,
      }],
    });
}

function documentWith(decorated: ReadonlyArray<{ kind: string; decorationId: string | null }>): Document {
  return new Document({
    sections: decorated.map(({ kind, decorationId }) => new Section({
      kind,
      segments: [new Segment({
        lines: [new Line({
          words: [new Word({
            text: 'word',
            time: new TimeFragment(0, 1),
            decoration: decorationId ? new Decoration({ id: decorationId, glyph: '🔥' }) : null,
          })],
        })],
      })],
    })),
  });
}

const filter = new DecorationFilter(new DecorationVisibility());

/** One caption whose words carry these decorations, in reading order; `null` for a bare word. */
function captionWith(decorationIds: ReadonlyArray<string | null>): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: [new Segment({
        lines: [new Line({
          words: decorationIds.map((decorationId, index) => new Word({
            text: `w${index}`,
            time: new TimeFragment(index, index + 1),
            decoration: decorationId ? new Decoration({ id: decorationId, glyph: '🔥' }) : null,
          })),
        })],
      })],
    })],
  });
}

function shownDecorationIds(doc: Document, overrides: DecorationOverrideRegistry, emojiEnabled = true): string[] {
  const shown = filter.filterDocument(doc, [sheet('main', emojiEnabled)], overrides);
  return shown.sections[0]!.segments.flatMap((segment) =>
    segment.getWords().flatMap((word) => (word.decoration ? [word.decoration.id] : [])));
}

describe('the emojis a caption shows', () => {
  it('is only the last of the ones transcription picked', () => {
    const doc = captionWith(['d1', null, 'd2', 'd3']);
    expect(shownDecorationIds(doc, DecorationOverrideRegistry.empty())).toEqual(['d3']);
  });

  it('is one per caption, each its own last', () => {
    const doc = new Document({
      sections: [new Section({
        kind: 'main',
        segments: [captionWith(['a1', 'a2']), captionWith(['b1', 'b2'])].map((caption) => caption.sections[0]!.segments[0]!),
      })],
    });
    expect(shownDecorationIds(doc, DecorationOverrideRegistry.empty())).toEqual(['a2', 'b2']);
  });

  // Deleting the pick is saying no to an emoji there, not asking for the
  // one before it.
  it('is none once the reader deletes the last one', () => {
    const doc = captionWith(['d1', 'd2']);
    const overrides = DecorationOverrideRegistry.empty().with('d2', { removed: true });
    expect(shownDecorationIds(doc, overrides)).toEqual([]);
    expect(filter.hasVisibleDecoration(doc, [sheet('main', true)], overrides)).toBe(false);
  });

  it('keeps one the reader added beside the pick', () => {
    const doc = captionWith(['u1', 'd1', 'd2']);
    const overrides = DecorationOverrideRegistry.empty().with('u1', { source: 'user' });
    expect(shownDecorationIds(doc, overrides)).toEqual(['u1', 'd2']);
  });

  it('keeps one whose glyph the reader changed, wherever it sits', () => {
    const doc = captionWith(['d1', 'd2']);
    const overrides = DecorationOverrideRegistry.empty().with('d1', { glyph: '🚀' });
    expect(shownDecorationIds(doc, overrides)).toEqual(['d1', 'd2']);
  });

  it('is only the reader\'s own while the effect is off', () => {
    const doc = captionWith(['u1', 'd1']);
    const overrides = DecorationOverrideRegistry.empty().with('u1', { source: 'user' });
    expect(shownDecorationIds(doc, overrides, false)).toEqual(['u1']);
  });
});

describe('whether a render paints any emoji', () => {
  it('says no for a document that carries none', () => {
    const doc = documentWith([{ kind: 'main', decorationId: null }]);
    expect(filter.hasVisibleDecoration(doc, [sheet('main', true)], DecorationOverrideRegistry.empty())).toBe(false);
  });

  it('says yes while the sheet keeps the emoji effect on', () => {
    const doc = documentWith([{ kind: 'main', decorationId: 'd1' }]);
    expect(filter.hasVisibleDecoration(doc, [sheet('main', true)], DecorationOverrideRegistry.empty())).toBe(true);
  });

  it('says no once the reader turns the effect off', () => {
    const doc = documentWith([{ kind: 'main', decorationId: 'd1' }]);
    expect(filter.hasVisibleDecoration(doc, [sheet('main', false)], DecorationOverrideRegistry.empty())).toBe(false);
  });

  it('says yes for one the reader added, effect off or not', () => {
    const doc = documentWith([{ kind: 'main', decorationId: 'd1' }]);
    const overrides = DecorationOverrideRegistry.empty().with('d1', { source: 'user' });
    expect(filter.hasVisibleDecoration(doc, [sheet('main', false)], overrides)).toBe(true);
  });

  it('says no for one the reader deleted, effect on or not', () => {
    const doc = documentWith([{ kind: 'main', decorationId: 'd1' }]);
    const overrides = DecorationOverrideRegistry.empty().with('d1', { removed: true });
    expect(filter.hasVisibleDecoration(doc, [sheet('main', true)], overrides)).toBe(false);
  });

  // Each section resolves against its own sheet, so one sheet's toggle
  // cannot answer for another's captions.
  it('asks each section its own sheet', () => {
    const sheets = [sheet('off', false), sheet('on', true)];
    const onlyOnTheOffSheet = documentWith([
      { kind: 'off', decorationId: 'd1' },
      { kind: 'on', decorationId: null },
    ]);
    const onlyOnTheOnSheet = documentWith([
      { kind: 'off', decorationId: null },
      { kind: 'on', decorationId: 'd2' },
    ]);
    expect(filter.hasVisibleDecoration(onlyOnTheOffSheet, sheets, DecorationOverrideRegistry.empty())).toBe(false);
    expect(filter.hasVisibleDecoration(onlyOnTheOnSheet, sheets, DecorationOverrideRegistry.empty())).toBe(true);
  });

  // `filterDocument` returns a section with no sheet untouched, so
  // everything on it reaches the render and this has to agree.
  it('counts a decoration whose section has no sheet', () => {
    const doc = documentWith([{ kind: 'orphan', decorationId: 'd1' }]);
    expect(filter.hasVisibleDecoration(doc, [sheet('main', false)], DecorationOverrideRegistry.empty())).toBe(true);
  });
});
