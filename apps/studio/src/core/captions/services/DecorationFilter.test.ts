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
