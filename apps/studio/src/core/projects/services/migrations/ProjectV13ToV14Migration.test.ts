import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import { FontFamilyField } from '@core/elements/domain/fields/FontFamilyField';
import { FontSizeField } from '@core/elements/domain/fields/FontSizeField';
import { FontWeightField } from '@core/elements/domain/fields/FontWeightField';
import { ItalicField } from '@core/elements/domain/fields/ItalicField';
import { RelativeSizeField } from '@core/elements/domain/fields/RelativeSizeField';
import { RotationField } from '@core/elements/domain/fields/RotationField';
import { StrikethroughField } from '@core/elements/domain/fields/StrikethroughField';
import { TextColorField } from '@core/elements/domain/fields/TextColorField';
import { UnderlineField } from '@core/elements/domain/fields/UnderlineField';
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LayerElementType } from '@core/elements/domain/types/LayerElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ProjectV13ToV14Migration } from '@core/projects/services/migrations/ProjectV13ToV14Migration';
import { StoredCaptionElementScanner } from '@core/projects/services/migrations/StoredCaptionElementScanner';
import { StoredTypographyReader } from '@core/projects/services/migrations/StoredTypographyReader';

/**
 * What a project keeps when how an element looks stops living beside
 * where it sits.
 *
 * Nothing else reads the retired keys, so a value this step drops is
 * one the user tuned and will never see again — and one it moves
 * without its declaration is a field showing a number that paints
 * nothing.
 */

const library = new ElementFieldLibrary([
  new ItalicField(),
  new UnderlineField(),
  new StrikethroughField(),
  new FontFamilyField(),
  new FontSizeField(),
  new RelativeSizeField(),
  new FontWeightField(),
  new TextColorField(),
  new RotationField(),
]);

const catalog = new StyledElementCatalog({
  segment: new SegmentElementType(library),
  line: new LineElementType(library),
  word: new WordElementType(library),
  decoration: new DecorationElementType(library),
  layer: new LayerElementType(library),
});

const writer = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
const finder = new CssControlledFieldFinder(writer);

const migration = new ProjectV13ToV14Migration(
  new StoredCaptionElementScanner(),
  new StoredTypographyReader(),
  catalog,
  writer,
);

function project(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 13,
    sheets: [{ id: 'main', typographyConfig: { fontSize: 10 } }],
    document: {
      sections: [{
        kind: 'main',
        segments: [{
          id: 'seg1',
          lines: [{ words: [{ id: 'w1', decoration: { id: 'w1:d' } }, { id: 'w2' }] }],
        }],
      }],
    },
    ...overrides,
  };
}

function migrated(overrides: Record<string, unknown>): ElementStyles {
  return ElementStyles.fromSnapshot(migration.migrate(project(overrides)).elementStyles as never);
}

describe('typography stored beside a position', () => {
  it('arrives as the field it is offered under, with the declaration it writes', () => {
    const styles = migrated({ wordStyleOverrides: { w1: { color: '#ff0000', italic: true } } });
    expect(styles.get('w1')?.fields).toEqual({ 'primary-color': '#ff0000', italic: 'italic' });
    expect(styles.get('w1')?.css).toContain('color: #ff0000;');
    expect(styles.get('w1')?.css).toContain('font-style: italic;');
  });

  // The field compares what it holds against what the CSS says, so a
  // declaration written any other way than the editor writes it would
  // grey every migrated field out on the first render.
  it('leaves no field reporting itself overruled by the CSS this step wrote', () => {
    const styles = migrated({
      wordStyleOverrides: { w1: { color: '#ff0000', italic: true, underline: true, strikethrough: true, fontSize: 12, rotation: 8 } },
      segmentOverrides: { style: { seg1: { fontFamily: 'Anton', fontWeight: 700, fontSize: 14 } } },
    });
    expect(finder.find(styles.get('w1'), catalog.controlsFor('word'))).toEqual(new Set());
    expect(finder.find(styles.get('seg1'), catalog.controlsFor('segment'))).toEqual(new Set());
  });

  it('reaches a wrapper through the variable its template reads', () => {
    const styles = migrated({ segmentOverrides: { style: { seg1: { color: '#00ff00' } } } });
    expect(styles.get('seg1')?.css).toContain('--tscaps-primary-color: #00ff00;');
  });

  it('drops a value the element has no field for', () => {
    const styles = migrated({ wordStyleOverrides: { 'w1:d': { fontFamily: 'Anton', rotation: 15 } } });
    expect(styles.get('w1:d')?.fields).toEqual({ rotation: 15 });
  });
});

describe('a size that named a share of the frame', () => {
  // A share of the frame and a ratio to the neighbours render at the
  // same place only when the ratio is taken against what the
  // surroundings were set at — the sheet for a scene, the scene for a
  // word, the word for the glyph riding it.
  it('becomes the ratio to the text around it, on a word', () => {
    const styles = migrated({ wordStyleOverrides: { w1: { fontSize: 15 } } });
    expect(styles.get('w1')?.fields).toEqual({ 'relative-size': 150 });
    expect(styles.get('w1')?.css).toContain('font-size: 150%;');
  });

  it('is read against the scene when the scene was resized too', () => {
    const styles = migrated({
      wordStyleOverrides: { w1: { fontSize: 15 } },
      segmentOverrides: { style: { seg1: { fontSize: 30 } } },
    });
    expect(styles.get('w1')?.fields).toEqual({ 'relative-size': 50 });
  });

  it('is read against its host word for a glyph', () => {
    const styles = migrated({ wordStyleOverrides: { w1: { fontSize: 20 }, 'w1:d': { fontSize: 30 } } });
    expect(styles.get('w1:d')?.fields).toEqual({ 'relative-size': 150 });
  });

  it('stays a share of the frame on a scene', () => {
    const styles = migrated({ segmentOverrides: { style: { seg1: { fontSize: 14 } } } });
    expect(styles.get('seg1')?.fields).toEqual({ 'font-size': 14 });
    expect(styles.get('seg1')?.css).toContain('--tscaps-font-size: 14cqh;');
  });
});

describe('what stays behind', () => {
  it('is where the element sits, and nothing about how it looks', () => {
    const data = migration.migrate(project({
      wordStyleOverrides: { w1: { color: '#ff0000', verticalOffset: 0.4, horizontalAlign: 'left', horizontalOffset: 0.2 } },
      segmentOverrides: {
        style: { seg1: { fontSize: 14, verticalOffset: 0.9 } },
        behindActor: { seg1: 'always' },
      },
    }));
    expect(data.wordStyleOverrides).toEqual({
      w1: { verticalOffset: 0.4, horizontalAlign: 'left', horizontalOffset: 0.2 },
    });
    expect(data.segmentOverrides).toEqual({
      style: { seg1: { verticalOffset: 0.9 } },
      behindActor: { seg1: 'always' },
    });
  });

  it('drops an entry that held nothing but typography', () => {
    const data = migration.migrate(project({
      wordStyleOverrides: { w1: { color: '#ff0000' } },
      segmentOverrides: { style: { seg1: { fontSize: 14 } }, behindActor: { seg1: 'never' } },
    }));
    expect(data.wordStyleOverrides).toEqual({});
    expect(data.segmentOverrides).toEqual({ behindActor: { seg1: 'never' } });
  });

  it('keeps CSS the element already carried, ahead of what the fields add', () => {
    const styles = migrated({
      elementStyles: { w1: { kind: 'word', css: 'letter-spacing: 2px;' } },
      wordStyleOverrides: { w1: { color: '#ff0000' } },
    });
    expect(styles.get('w1')?.css).toContain('letter-spacing: 2px;');
    expect(styles.get('w1')?.css).toContain('color: #ff0000;');
  });
});
