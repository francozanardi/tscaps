import { describe, expect, it } from 'vitest';
import { CssBlockSealer, CssMinifier } from '@tscaps/engine/advanced';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SetElementCssAction } from '@core/elements/actions/SetElementCssAction';
import { BalancedBlocksElementCssRule } from '@core/elements/services/css/BalancedBlocksElementCssRule';
import { ElementCssValidator } from '@core/elements/services/css/ElementCssValidator';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { PlayheadAnchoredAnimationElementCssRule } from '@core/elements/services/css/PlayheadAnchoredAnimationElementCssRule';
import { UndrawnLayerDeclarationElementCssRule } from '@core/elements/services/css/UndrawnLayerDeclarationElementCssRule';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import { ElementCssReads } from '@core/editor-operations/services/ElementCssReads';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { SetElementCssOperation } from '@core/editor-operations/services/descriptors/SetElementCssOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { SetShotLayerCssAction } from '@core/shots/actions/SetShotLayerCssAction';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';

const project = new CaptionOperationsTestProject();


function captionedProject(): EditorStore {
  return project.store([project.sheet('main', project.template({ id: 'plain' }))]);
}

function operationOn(store: EditorStore): SetElementCssOperation {
  const parser = new EditorRefParser();
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  return new SetElementCssOperation(
    new CaptionRefResolver(store, parser),
    new ShotRefResolver(store, materializer, parser),
    new SetElementCssAction(store, project.inertRefresh()),
    new SetShotLayerCssAction(store, materializer),
    new ElementCssValidator(new CssMinifier(), new ElementTimingVariableResolver(), [
      new BalancedBlocksElementCssRule(new CssBlockSealer()),
      new PlayheadAnchoredAnimationElementCssRule(),
      new UndrawnLayerDeclarationElementCssRule(),
    ]),
    new CssWriteGate(),
    new ElementCssReads(store),
  );
}


describe('set_element_css', () => {
  it('puts the CSS on the caption element named', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ element: 'word:w1', css: 'color: gold;' });

    expect(result.ok).toBe(true);
    expect(store.snapshot().elementStyles.get('w1')?.css).toBe('color: gold;');
  });

  it('refuses CSS that would load something from the network, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:w1', css: 'background: url(https://example.com/a.png);' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });

  it('writes CSS the editor will not draw as written, and says so in warnings', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ element: 'word:w1', css: 'color: gold; }' });

    expect(result.ok).toBe(true);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems.every((problem) => problem.severity === 'warning')).toBe(true);
    expect(store.snapshot().elementStyles.get('w1')).not.toBeNull();
  });

  it('refuses a ref that is gone, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:gone', css: 'color: gold;' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.ref).toBe('word:gone');
    expect(store.snapshot()).toBe(before);
  });




  it('refuses to write over CSS it has not seen, answering it, and writes when asked again', async () => {
    const store = captionedProject();
    store.patch({ elementStyles: store.snapshot().elementStyles.withCss('w1', 'word', 'font-style: italic;') });
    const operation = operationOn(store);

    const refused = await operation.run({ element: 'word:w1', css: 'color: gold;' });
    const repeated = await operation.run({ element: 'word:w1', css: 'color: gold;' });

    expect(refused.ok).toBe(false);
    expect((refused.output as { css: string }).css).toBe('font-style: italic;');
    expect(repeated.ok).toBe(true);
    expect(store.snapshot().elementStyles.get('w1')?.css).toBe('color: gold;');
  });

  it('refuses again once something else changed the CSS after its own write', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ element: 'word:w1', css: 'color: gold;' });
    store.patch({ elementStyles: store.snapshot().elementStyles.withCss('w1', 'word', 'color: gold; font-weight: 900;') });

    const result = await operation.run({ element: 'word:w1', css: 'color: red;' });

    expect(result.ok).toBe(false);
    expect(store.snapshot().elementStyles.get('w1')?.css).toBe('color: gold; font-weight: 900;');
  });

  it('refuses to write over CSS that was emptied since its own write', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ element: 'word:w1', css: 'color: gold;' });
    store.patch({ elementStyles: store.snapshot().elementStyles.withCss('w1', 'word', '') });

    const result = await operation.run({ element: 'word:w1', css: 'color: gold; font-weight: 900;' });

    expect(result.ok).toBe(false);
    expect((result.output as { css: string }).css).toBe('');
  });
});
