import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ResetCaptionElementAction } from '@core/elements/actions/ResetCaptionElementAction';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ClearElementStyleOperation } from '@core/editor-operations/services/descriptors/ClearElementStyleOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';

const project = new CaptionOperationsTestProject();

function captionedProject(): EditorStore {
  const store = project.store([project.sheet('main', project.template({ id: 'plain' }))]);
  store.patch({ elementStyles: store.snapshot().elementStyles.withCss('w1', 'word', 'color: gold;') });
  return store;
}

function operationOn(store: EditorStore): ClearElementStyleOperation {
  return new ClearElementStyleOperation(
    new CaptionRefResolver(store, new EditorRefParser()),
    store,
    new ResetCaptionElementAction(store, project.inertRefresh()),
    new CaptionReflowDetector(),
  );
}

describe('clear_element_style', () => {
  it('takes back everything the element was styled with', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ element: 'word:w1' });

    expect(result.output).toEqual({ element: 'word:w1', cleared: true });
    expect(store.snapshot().elementStyles.get('w1')).toBeNull();
  });

  it('sends a layer to the operations that can clear it, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'layer:anything' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('set_element_css');
    expect(store.snapshot()).toBe(before);
  });

  it('refuses a ref that is gone, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ element: 'word:gone' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});
