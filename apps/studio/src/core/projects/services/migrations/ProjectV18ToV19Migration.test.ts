import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { FontFamilyField } from '@core/elements/domain/fields/FontFamilyField';
import { FontSizeField } from '@core/elements/domain/fields/FontSizeField';
import { FontWeightField } from '@core/elements/domain/fields/FontWeightField';
import { ItalicField } from '@core/elements/domain/fields/ItalicField';
import { RelativeSizeField } from '@core/elements/domain/fields/RelativeSizeField';
import { RotationField } from '@core/elements/domain/fields/RotationField';
import { StrikethroughField } from '@core/elements/domain/fields/StrikethroughField';
import { TextColorField } from '@core/elements/domain/fields/TextColorField';
import { UnderlineField } from '@core/elements/domain/fields/UnderlineField';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { FontStack } from '@core/fonts/domain/FontStack';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import { ProjectV18ToV19Migration } from '@core/projects/services/migrations/ProjectV18ToV19Migration';

const library = new FontStackLibrary();
const fieldLibrary = new ElementFieldLibrary([
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
  segment: new SegmentElementType(fieldLibrary),
  line: new LineElementType(fieldLibrary),
  word: new WordElementType(fieldLibrary),
  decoration: new DecorationElementType(fieldLibrary),
});
const cssWriter = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
const migration = new ProjectV18ToV19Migration(catalog, cssWriter, new StoredFontStackReader(library));

/**
 * Every project stored before a font was a stack held one family, and
 * the faces for the other writing systems were looked up behind it. The
 * migration writes those faces down.
 *
 * So the promise is relational: a migrated project paints what it
 * painted. The stack a family led is exactly the set of stand-ins the
 * old resolution would have reached for.
 */

function projectWithSheetSetIn(fontFamily: string): Record<string, unknown> {
  return {
    version: 18,
    sheets: [{ id: 'main', typographyConfig: { fontFamily, fontSize: 4 }, styleValues: {} }],
  };
}

function sheetOf(migrated: Record<string, unknown>): Record<string, unknown> {
  return (migrated.sheets as Record<string, unknown>[])[0]!;
}

function typographyOf(migrated: Record<string, unknown>): Record<string, unknown> {
  return sheetOf(migrated).typographyConfig as Record<string, unknown>;
}

describe('a sheet set in one family', () => {
  it('is set in the stack that family led', () => {
    const migrated = migration.migrate(projectWithSheetSetIn('Anton'));
    expect(typographyOf(migrated).fontStack).toEqual(library.stackFor('anton').toSnapshot());
  });

  it('stops holding the family on its own', () => {
    const migrated = migration.migrate(projectWithSheetSetIn('Anton'));
    expect(typographyOf(migrated).fontFamily).toBeUndefined();
  });

  it('keeps the rest of its typography', () => {
    const migrated = migration.migrate(projectWithSheetSetIn('Anton'));
    expect(typographyOf(migrated).fontSize).toBe(4);
  });

  // A font the reader uploaded. Its coverage is unknowable, so it keeps
  // drawing what it was drawing and designed faces answer for the rest.
  it('keeps a family the catalog never knew in the Latin seat', () => {
    const migrated = migration.migrate(projectWithSheetSetIn('Comic Papyrus'));
    const stack = FontStack.fromStoredFaces(typographyOf(migrated).fontStack);
    expect(stack?.familyFor('latin')).toBe('Comic Papyrus');
    expect(stack?.familyFor('arabic')).toBe(library.stackFor('inter').familyFor('arabic'));
  });
});

/**
 * A control id is the template author's to choose, so nothing here may
 * key on one. The fonts a template's controls hold are opened where the
 * fields are at hand to say which of them are fonts; this step leaves
 * every stored control value exactly as it found it.
 */
describe('the style controls of a sheet', () => {
  it('come out untouched, family names included', () => {
    const values = { 'tag-font-family': 'Kalam', 'primary-color': '#ffffff', 'label-text': 'Anton' };
    const migrated = migration.migrate({
      version: 18,
      sheets: [{ id: 'main', typographyConfig: { fontFamily: 'Anton' }, styleValues: values }],
    });
    expect(sheetOf(migrated).styleValues).toEqual(values);
  });
});

/**
 * An element records what its field holds and declares the same thing in
 * its own CSS, and the panel tells a field it still owns from one edited
 * by hand by writing the record again and seeing whether the text moves.
 * Migrating the record without the declaration would report every
 * migrated element as overruled by CSS it wrote itself.
 */
describe('an element given a face of its own', () => {
  const WORD_ID = 'w1';

  function migratedStyles(css: string): ElementStyles {
    const migrated = migration.migrate({
      version: 18,
      sheets: [],
      elementStyles: {
        [WORD_ID]: { kind: 'word', css, fields: { [ElementFieldId.FONT_FAMILY]: 'Anton' } },
      },
    });
    return ElementStyles.fromSnapshot(migrated.elementStyles as never);
  }

  it('records the stack that face led', () => {
    const stack = migratedStyles('font-family: "Anton";').fieldStack(WORD_ID, ElementFieldId.FONT_FAMILY);
    expect(stack?.toSnapshot()).toEqual(library.stackFor('anton').toSnapshot());
  });

  it('still owns its declaration afterwards', () => {
    const styles = migratedStyles('font-family: "Anton";');
    const controls = catalog.controlsFor('word');
    const taken = new CssControlledFieldFinder(cssWriter).find(styles.get(WORD_ID) ?? null, controls);
    expect(taken.has(ElementFieldId.FONT_FAMILY)).toBe(false);
  });

  it('leaves the CSS written by hand beside it standing', () => {
    const styles = migratedStyles('font-family: "Anton";\nletter-spacing: 0.2em;');
    expect(styles.get(WORD_ID)?.css).toContain('letter-spacing: 0.2em;');
  });
});
