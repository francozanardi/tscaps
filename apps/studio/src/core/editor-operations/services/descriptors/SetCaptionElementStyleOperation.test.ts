import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { DocumentElementDescendantResolver } from '@core/captions/services/DocumentElementDescendantResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SetElementCssAction } from '@core/elements/actions/SetElementCssAction';
import { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import { SetElementPlacementAction } from '@core/elements/actions/SetElementPlacementAction';
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
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { FieldShadowingDeclarations } from '@core/elements/services/css/FieldShadowingDeclarations';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SetCaptionElementStyleOperation } from '@core/editor-operations/services/descriptors/SetCaptionElementStyleOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';

const project = new CaptionOperationsTestProject();
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
const cssParser = new CssFragmentParser(new CssMinifier());
const writer = new ElementControlCssWriter(cssParser);

function captionedProject(options: { holdsVerticalAnchor?: boolean } = {}): EditorStore {
  return project.store([project.sheet('main', project.template({ id: 'plain', ...options }))]);
}

function operationOn(store: EditorStore): SetCaptionElementStyleOperation {
  const finder = new CssControlledFieldFinder(writer);
  return new SetCaptionElementStyleOperation(
    new CaptionRefResolver(store, new EditorRefParser()),
    new CaptionSceneLocator(),
    store,
    catalog,
    new FontStackLibrary(),
    finder,
    new SetElementFieldAction(store, catalog, new DocumentElementDescendantResolver(store), writer, finder, project.inertRefresh()),
    new SetElementPlacementAction(store, project.inertRefresh()),
    new FieldShadowingDeclarations(cssParser),
    new SetElementCssAction(store, project.inertRefresh()),
  );
}

describe('set_caption_element_style', () => {
  it('sets the same fields on every element named, as fields and their CSS', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({
      elements: ['word:w1', 'word:w3'],
      fields: { 'italic': true, 'primary-color': '#ffd400', 'relative-size': 150, 'font-family': 'poppins' },
    });

    expect(result.output).toEqual({ changed: ['word:w1', 'word:w3'] });
    const word = store.snapshot().elementStyles.get('w3');
    expect(word?.fields).toMatchObject({ 'italic': 'italic', 'primary-color': '#ffd400', 'relative-size': 150 });
    expect(word?.fields?.['font-family']).toMatchObject({ latin: 'Poppins' });
    expect(word?.css).toContain('color: #ffd400');
  });

  it('takes a field off with null', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ elements: ['segment:s1'], fields: { 'underline': true, 'font-size': 6 } });

    await operation.run({ elements: ['segment:s1'], fields: { 'underline': null } });

    expect(store.snapshot().elementStyles.get('s1')?.fields).toEqual({ 'font-size': 6 });
  });

  it('takes out of the CSS a declaration that would hide the field, keeping the rest, and says so', async () => {
    const store = captionedProject();
    new SetElementCssAction(store, project.inertRefresh()).execute('s1', 'segment', 'font-size: 1.4em;\n& :where(.word) { font-size: 2em; }');

    const result = await operationOn(store).run({ elements: ['segment:s1'], fields: { 'font-size': 3.8 } });

    const css = store.snapshot().elementStyles.get('s1')?.css ?? '';
    expect(css).not.toMatch(/^font-size: 1\.4em/m);
    expect(css).toContain('& :where(.word) { font-size: 2em; }');
    expect(css).toContain('--tscaps-font-size: 3.8cqh');
    expect(result.output).toEqual({ changed: ['segment:s1'] });
    expect(result.problems[0]?.message).toContain('font-size: 1.4em');
  });

  it('refuses a field the element does not offer, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ elements: ['segment:s1', 'word:w1'], fields: { 'font-size': 6 } });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('relative-size');
    expect(store.snapshot()).toBe(before);
  });

  it('refuses a font it does not ship and a size out of range', async () => {
    const store = captionedProject();
    const operation = operationOn(store);

    const font = await operation.run({ elements: ['word:w1'], fields: { 'font-family': 'Comic Sans MS' } });
    const size = await operation.run({ elements: ['word:w1'], fields: { 'relative-size': 1000 } });

    expect(font.ok).toBe(false);
    expect(size.problems[0]?.message).toContain('10 to 400');
  });

  it('places a word with its centre on the point, and puts it back in its caption with null', async () => {
    const store = captionedProject();
    const operation = operationOn(store);

    await operation.run({ elements: ['word:w1'], placement: { x: 0.25, y: 0.4 } });
    expect(store.snapshot().elementStyles.placementOf('w1')).toEqual({
      verticalAlign: 'center', verticalOffset: 0.4, horizontalAlign: 'center', horizontalOffset: 0.25,
    });

    await operation.run({ elements: ['word:w1'], placement: null });
    expect(store.snapshot().elementStyles.placementOf('w1')).toBeNull();
  });

  it('keeps the edge a template holds when placing a segment, and says so', async () => {
    const store = captionedProject({ holdsVerticalAnchor: true });

    const result = await operationOn(store).run({ elements: ['segment:s1'], placement: { x: 0.5, y: 0.7 } });

    expect(store.snapshot().elementStyles.placementOf('s1')?.verticalAlign).toBe('bottom');
    expect(result.problems).toMatchObject([{ severity: 'warning', ref: 'segment:s1' }]);
  });

  it('refuses to place a line, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ elements: ['line:l1'], placement: { x: 0.5, y: 0.5 } });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});
