import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { DocumentElementDescendantResolver } from '@core/captions/services/DocumentElementDescendantResolver';
import { DocumentSheetElementResolver } from '@core/captions/services/DocumentSheetElementResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SetElementAnimationAction } from '@core/elements/actions/SetElementAnimationAction';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LayerElementType } from '@core/elements/domain/types/LayerElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import { BUILTIN_ANIMATION_FIELDS } from '@core/elements/infrastructure/BuiltinAnimationFields';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { AnimationValueComposer } from '@core/elements/services/css/AnimationValueComposer';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { AnimationPresetCheck } from '@core/editor-operations/services/AnimationPresetCheck';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SheetAnimationWriter } from '@core/editor-operations/services/SheetAnimationWriter';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { SetElementAnimationOperation } from '@core/editor-operations/services/descriptors/SetElementAnimationOperation';
import { CaptionOperationsTestProject, type TestTemplateOptions } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { ReplaceSheetAnimationAction } from '@core/sheets/actions/style/ReplaceSheetAnimationAction';
import { ResetSheetMotionAction } from '@core/sheets/actions/style/ResetSheetMotionAction';
import { TuneSheetAnimationAction } from '@core/sheets/actions/style/TuneSheetAnimationAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import { AddShotLayerAction } from '@core/shots/actions/AddShotLayerAction';
import { SetShotLayerAnimationAction } from '@core/shots/actions/SetShotLayerAnimationAction';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import { TemplateAnimationAnswerResolver } from '@core/templates/services/animations/TemplateAnimationAnswerResolver';
import { TemplateAnimationFieldResolver } from '@core/templates/services/animations/TemplateAnimationFieldResolver';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';

const project = new CaptionOperationsTestProject();
const catalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
const timing = new ElementTimingVariableResolver();
const builder = new ElementAnimationCssBuilder(catalog, timing, new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())));
const writer = new ElementAnimationCssWriter(builder);
const sync = new LinkedSheetsSync(new LinkedSheetsPropagationNotifier());
/** A template's words rising in, as its stylesheet declares it. */
const RISING_WORDS: DeclaredAnimation = {
  id: 'rise-in',
  element: 'word',
  values: { '--entrance-rise': { kind: 'number', amount: 0.3, unit: 'em' }, '--entrance-duration': { kind: 'number', amount: 0.4, unit: 's' } },
  keyframes: [],
};
// Only which parts each kind can animate is asked of it, never its fields.
const noFields = new ElementFieldLibrary([]);
const styledElements = new StyledElementCatalog({
  segment: new SegmentElementType(noFields),
  line: new LineElementType(noFields),
  word: new WordElementType(noFields),
  decoration: new DecorationElementType(noFields),
  layer: new LayerElementType(noFields),
});
const materializer = new ShotPartitionMaterializer(
  new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
  new OriginalCaptionTrackReader(),
);

function captionedProject(options: Omit<TestTemplateOptions, 'id'> = {}): EditorStore {
  return project.store([project.sheet('main', project.template({ id: 'plain', ...options }))]);
}

function operationOn(store: EditorStore): SetElementAnimationOperation {
  const parser = new EditorRefParser();
  const presets = new AnimationPresetCheck(catalog, timing);
  const support = new AnimationSupportResolver();
  const refresh = project.inertRefresh();
  return new SetElementAnimationOperation(
    new CaptionRefResolver(store, parser),
    new ShotRefResolver(store, materializer, parser),
    new CaptionSceneLocator(),
    store,
    new SheetRefResolver(store, parser),
    styledElements,
    presets,
    writer,
    support,
    new SetElementAnimationAction(store, new DocumentElementDescendantResolver(store), writer, refresh),
    new SetShotLayerAnimationAction(store, materializer, catalog, writer, new RecordingShotTelemetry().edits),
    new SheetAnimationWriter(
      store,
      new ActiveSheetEditRunner(store, new SetActiveSheetAction(store)),
      presets,
      support,
      new TemplateAnimationAnswerResolver(catalog, timing),
      new TemplateAnimationFieldResolver(BUILTIN_ANIMATION_FIELDS, new ElementControlValueParser()),
      new ReplaceSheetAnimationAction(store, new DocumentSheetElementResolver(store), builder, writer, sync, refresh, support),
      new TuneSheetAnimationAction(store, builder, new AnimationValueComposer(), sync),
      new ResetSheetMotionAction(store, refresh, sync),
    ),
  );
}

/** Puts a b-roll layer, `layer`, on the first shot. */
function withLayer(store: EditorStore): void {
  const shotId = materializer.materializeFrom(store.snapshot()).list()[0]!.id;
  new AddShotLayerAction(store, materializer).execute(shotId, { id: 'layer', mediaId: 'clip', inSec: 0, outSec: null, loop: false });
}

describe('set_element_animation on a caption', () => {
  it('gives the part a preset and sets the fields asked for', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ element: 'word:w1', scope: 'self', preset: 'rise-in', params: { distance: 0.5 } });

    expect(result.ok).toBe(true);
    expect(store.snapshot().elementStyles.animationOf('w1', ElementAnimationScope.SELF)).toEqual({ presetId: 'rise-in', params: { distance: 0.5 } });
  });

  it('stops the part moving with "none", and gives it back to the template with null', async () => {
    const store = captionedProject();
    const operation = operationOn(store);

    await operation.run({ element: 'segment:s1', scope: 'words', preset: 'none' });
    const stopped = store.snapshot().elementStyles.animationOf('s1', ElementAnimationScope.WORDS);
    await operation.run({ element: 'segment:s1', scope: 'words', preset: null });

    expect(stopped?.presetId).toBeNull();
    expect(store.snapshot().elementStyles.animationOf('s1', ElementAnimationScope.WORDS)).toBeNull();
  });

  it('refuses a scope the element does not offer, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:w1', scope: 'words', preset: 'rise-in' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('refuses a preset that does not fit the part, naming some that do', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:w1', scope: 'self', preset: 'layer-fade-entrance' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('rise-in');
    expect(store.snapshot()).toBe(before);
  });

  it('refuses a field value outside its range, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:w1', scope: 'self', preset: 'rise-in', params: { distance: 5 } });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('refuses to animate a scene of a template that offers no animation there', async () => {
    const store = captionedProject({ animatesScenes: false });
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'segment:s1', scope: 'self', preset: 'pop-in' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('refuses a part whose animation was rewritten by hand, pointing at its CSS', async () => {
    const store = captionedProject();
    await operationOn(store).run({ element: 'word:w1', scope: 'self', preset: 'pop-in' });
    const styles = store.snapshot().elementStyles;
    store.patch({ elementStyles: styles.withCss('w1', 'word', styles.get('w1')!.css.replace('pop', 'pop-slowly')) });
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:w1', scope: 'self', preset: 'rise-in' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('set_element_css');
    expect(store.snapshot()).toBe(before);
  });
});

describe('set_element_animation on a layer', () => {
  it('gives the layer an entrance and sets its fields', async () => {
    const store = captionedProject();
    withLayer(store);

    const result = await operationOn(store).run({ element: 'layer:layer', scope: 'entrance', preset: 'layer-fade-entrance', params: { duration: 1 } });

    expect(result.ok).toBe(true);
    expect(store.snapshot().shots.layerStyles.animationOf('layer', ElementAnimationScope.ENTRANCE))
      .toEqual({ presetId: 'layer-fade-entrance', params: { duration: 1 } });
  });

  it('sends a camera move to set_camera, and changes nothing', async () => {
    const store = captionedProject();
    withLayer(store);
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'layer:layer', scope: 'camera', preset: 'layer-shake-camera' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('set_camera');
    expect(store.snapshot()).toBe(before);
  });
});

describe('set_element_animation on a sheet', () => {
  it('gives every word under the sheet a preset, taking the words\' own animation off them', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ element: 'word:w1', scope: 'self', preset: 'pop-in' });

    const result = await operation.run({ element: 'sheet:main', scope: 'words', preset: 'rise-in', params: { distance: 0.5 } });

    expect(result.output).toEqual({ element: 'sheet:main', scope: 'words', preset: 'rise-in', params: { distance: 0.5 } });
    const answer = store.sheet('main')?.animations.get(ElementAnimationScope.WORDS);
    expect(answer?.kind === 'replaced' ? answer.animation : null).toEqual({ presetId: 'rise-in', params: { distance: 0.5 } });
    expect(store.snapshot().elementStyles.animationOf('w1', ElementAnimationScope.SELF)).toBeNull();
  });

  it('stops the words moving with "none", and gives them back to the template with null', async () => {
    const store = captionedProject({ declaredAnimations: [RISING_WORDS] });
    const operation = operationOn(store);

    await operation.run({ element: 'sheet:main', scope: 'words', preset: 'none' });
    const stopped = store.sheet('main')?.animations.get(ElementAnimationScope.WORDS);
    await operation.run({ element: 'sheet:main', scope: 'words', preset: null });

    expect(stopped?.kind === 'replaced' ? stopped.animation.presetId : 'not stopped').toBeNull();
    expect(store.sheet('main')?.animations.get(ElementAnimationScope.WORDS)).toBeNull();
  });

  it('tunes the template\'s own animation when asked for the preset the template already plays', async () => {
    const store = captionedProject({ declaredAnimations: [RISING_WORDS] });

    const result = await operationOn(store).run({ element: 'sheet:main', scope: 'words', preset: 'rise-in', params: { duration: 0.8 } });

    expect(result.output).toMatchObject({ preset: 'rise-in', byTemplate: true, params: { duration: 0.8 } });
    expect(store.sheet('main')?.animations.get(ElementAnimationScope.WORDS)?.kind).toBe('tuned');
  });

  it('refuses a scope a sheet does not offer, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'sheet:main', scope: 'self', preset: 'rise-in' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});
