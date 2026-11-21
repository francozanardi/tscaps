import { describe, expect, it } from 'vitest';
import { SvgFilterDefinitions, SvgFilterDefinitionsParser } from '@tscaps/engine';
import { CssBlockSealer, CssMinifier } from '@tscaps/engine/advanced';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SheetCssWriteChecker } from '@core/editor-operations/services/SheetCssWriteChecker';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { SetSheetCssOperation } from '@core/editor-operations/services/descriptors/SetSheetCssOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { UpdateSheetCssOverrideAction } from '@core/sheets/actions/style/UpdateSheetCssOverrideAction';
import { UpdateSheetFiltersSvgOverrideAction } from '@core/sheets/actions/style/UpdateSheetFiltersSvgOverrideAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { TemplateContractValidatorFactory } from '@core/templates/services/contract/TemplateContractValidatorFactory';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';

const MARKER_FILE = '/app/assets/marker-stroke.png';
const GLOW_FILTERS = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="glow"><feGaussianBlur stdDeviation="2"/></filter></svg>';

/**
 * Reads filters the way the browser's parser answers them, which Node
 * lacks: a source that closes its `<svg>` parses, any other does not.
 */
const filtersParser = {
  parse: (source: string) => {
    if (!source.trim().endsWith('</svg>')) throw new Error('SVG filter parse error: unclosed element');
    return new SvgFilterDefinitions([]);
  },
} as unknown as SvgFilterDefinitionsParser;

const project = new CaptionOperationsTestProject();
const plain = project.template({ id: 'plain', css: '.word { color: white; }' });
const marked = project.template({ id: 'marked', css: `.word { mask-image: url('${MARKER_FILE}'); }` });

/** Captions on `main` (active, on a template whose CSS loads an image file of its own) and on `hook`. */
function twoSheetProject(): EditorStore {
  return project.store([project.sheet('main', marked), project.sheet('hook', plain)]);
}

function operationOn(store: EditorStore, parser: SvgFilterDefinitionsParser = new SvgFilterDefinitionsParser()): SetSheetCssOperation {
  const refs = new EditorRefParser();
  const sync = new LinkedSheetsSync(new LinkedSheetsPropagationNotifier());
  const contractValidator = new TemplateContractValidatorFactory(new StyleControlCatalog(new SimilarNameFinder()), new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/'))
    .create({ has: () => true });
  return new SetSheetCssOperation(
    new SheetRefResolver(store, refs),
    store,
    refs,
    new ActiveSheetEditRunner(store, new SetActiveSheetAction(store)),
    new UpdateSheetCssOverrideAction(store, project.inertRefresh(), sync),
    new UpdateSheetFiltersSvgOverrideAction(store, project.inertRefresh(), sync),
    project.inertRefresh(),
    new SheetCssWriteChecker(new CssWriteGate(), new CssMinifier(), new CssBlockSealer(), contractValidator, parser),
    new CaptionReflowDetector(),
  );
}

describe('set_sheet_css', () => {
  it('replaces the CSS of the sheet named, leaving the active sheet on screen, and gives the template\'s back with null', async () => {
    const store = twoSheetProject();
    const operation = operationOn(store);

    const replaced = await operation.run({ css: '.word { color: gold; }', sheet: 'sheet:hook' });
    const drawn = store.sheet('hook')?.resolveCss();
    const activeSheetId = store.snapshot().activeSheetId;
    await operation.run({ css: null, sheet: 'sheet:hook' });

    expect(replaced.output).toEqual({ sheet: 'sheet:hook', css: 'custom', changed: true });
    expect([drawn, activeSheetId]).toEqual(['.word { color: gold; }', 'main']);
    expect(store.sheet('hook')?.resolveCss()).toBe('.word { color: white; }');
  });

  it('refuses CSS that would load something from the network, and changes nothing', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ css: '.word { background: url(https://example.com/a.png); }' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('refuses braces that do not pair up, and changes nothing', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ css: '.word { color: gold;' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('lets through the image files the template\'s own CSS already loads', async () => {
    const store = twoSheetProject();

    const result = await operationOn(store).run({ css: `.word { color: gold; mask-image: url('${MARKER_FILE}'); }` });

    expect(result.ok).toBe(true);
    expect(store.sheet('main')?.cssOverride).toContain('color: gold');
  });

  it('writes CSS breaking the template contract, and answers what breaks it as warnings', async () => {
    const store = twoSheetProject();

    const result = await operationOn(store).run({ css: '.word { color: var(--nothing-writes-this); }', sheet: 'sheet:hook' });

    expect(result.ok).toBe(true);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems.every((problem) => problem.severity === 'warning')).toBe(true);
  });

  it('replaces the filters of the sheet named, and gives the template\'s back with null', async () => {
    const store = twoSheetProject();
    const operation = operationOn(store, filtersParser);

    const replaced = await operation.run({ filtersSvg: GLOW_FILTERS, sheet: 'sheet:hook' });
    const drawn = store.sheet('hook')?.resolveFiltersSvg();
    await operation.run({ filtersSvg: null, sheet: 'sheet:hook' });

    expect(replaced.output).toEqual({ sheet: 'sheet:hook', filtersSvg: 'custom', changed: true });
    expect([drawn, store.snapshot().activeSheetId]).toEqual([GLOW_FILTERS, 'main']);
    expect(store.sheet('hook')?.filtersSvgOverride).toBeNull();
  });

  it('refuses filters that do not parse, or that load something from the network, and writes neither source', async () => {
    const store = twoSheetProject();
    const before = store.snapshot();
    const operation = operationOn(store, filtersParser);

    const unclosed = await operation.run({ css: '.word { color: gold; }', filtersSvg: '<svg><filter id="glow">' });
    const reaching = await operation.run({ filtersSvg: '<svg><filter id="x"><feImage href="https://example.com/a.png"/></filter></svg>' });

    expect([unclosed.ok, reaching.ok]).toEqual([false, false]);
    expect(store.snapshot()).toBe(before);
  });
});
