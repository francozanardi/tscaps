import { describe, expect, it } from 'vitest';
import { Decoration, Line, Segment, TimeFragment, Word, type AlignmentConfig, type SvgFilterDefinitions } from '@tscaps/engine';
import type { EmojiPlacement } from '@core/effect/domain/EffectConfig';
import { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';

/**
 * Where a caption's emojis go when the sheet lifts them out of their
 * words. Around is the one placement that answers per caption, and what
 * it promises is that the answer is the caption's own: the same for all
 * of its emojis, the same every time it is asked, and not the same for
 * every caption.
 */

const ALIGNMENT: AlignmentConfig = { verticalAlign: 'bottom', verticalOffset: 0.8, horizontalAlign: 'center', horizontalOffset: 0.5 };

function sheetPlacing(placement: EmojiPlacement): Sheet {
  const template = new Template(
    { id: 'emojis', category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    [{ type: 'emoji', enabled: true, placement, size: 1, gap: 0 }],
    [],
    { type: 'none' } as unknown as LineSplitterConfig,
    [],
    [],
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
  return Sheet.fromTemplate('main', 'Main', null, template, 'ltr');
}

/** A caption whose second and third words carry an emoji. */
const CAPTION = new Segment({
  id: 's1',
  lines: [new Line({
    id: 'l1',
    words: ['we', 'did', 'it'].map((text, i) => new Word({
      id: `w${i}`,
      text,
      time: new TimeFragment(i, i + 1),
      ...(i > 0 ? { decoration: new Decoration({ id: `w${i}:d`, glyph: '🔥' }) } : {}),
    })),
  })],
});

const resolver = new DecorationPlacementResolver();

describe('emojis placed around the caption', () => {
  const around = sheetPlacing('segment-around');

  it('go to one side together', () => {
    const sides = new Set(resolver.buildSegmentPlacements(around, CAPTION, 3).values());
    expect(sides.size).toBe(1);
  });

  it('keep their side for as long as the caption keeps its place', () => {
    for (let position = 0; position < 12; position++) {
      const first = resolver.buildSegmentPlacements(around, CAPTION, position);
      const again = resolver.buildSegmentPlacements(around, CAPTION, position);
      expect([...again]).toEqual([...first]);
    }
  });

  it('go above some captions and below others', () => {
    const sides = new Set<string>();
    for (let position = 0; position < 12; position++) {
      for (const side of resolver.buildSegmentPlacements(around, CAPTION, position).values()) sides.add(side);
    }
    expect([...sides].sort()).toEqual(['above', 'below']);
  });
});

describe('emojis placed on one side', () => {
  it('go to that side on every caption', () => {
    for (const [placement, side] of [['segment-above', 'above'], ['segment-below', 'below']] as const) {
      for (let position = 0; position < 12; position++) {
        const placements = resolver.buildSegmentPlacements(sheetPlacing(placement), CAPTION, position);
        expect([...placements.values()]).toEqual([side, side]);
      }
    }
  });
});

describe('emojis kept inline', () => {
  it('are not lifted out of their words', () => {
    expect(resolver.buildSegmentPlacements(sheetPlacing('word'), CAPTION, 0).size).toBe(0);
  });
});
