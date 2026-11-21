import { describe, expect, it } from 'vitest';
import { SetSegmentsHiddenAction } from '@core/captions/actions/segments/SetSegmentsHiddenAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SetSegmentsHiddenOperation } from '@core/editor-operations/services/descriptors/SetSegmentsHiddenOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { ShotPartition } from '@core/shots/domain/ShotPartition';

const project = new CaptionOperationsTestProject();

function captionedProject(): EditorStore {
  return project.store([project.sheet('main', project.template({ id: 'plain' }))]);
}

function operationOn(store: EditorStore): SetSegmentsHiddenOperation {
  return new SetSegmentsHiddenOperation(
    new CaptionRefResolver(store, new EditorRefParser()),
    store,
    new SetSegmentsHiddenAction(store, project.deriverFor(store)),
  );
}

function hiddenScenes(store: EditorStore): string[] {
  return store.snapshot().document!.getSegments().filter((segment) => segment.hidden).map((segment) => segment.id);
}

describe('set_segments_hidden', () => {
  it('hides the scenes named and answers the ones that changed', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ segments: ['segment:s1'], hidden: true });

    expect(result.output).toEqual({ hidden: true, changed: ['segment:s1'] });
    expect(hiddenScenes(store)).toEqual(['s1']);
  });

  it('shows a hidden scene again', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ segments: ['segment:s1'], hidden: true });

    await operation.run({ segments: ['segment:s1'], hidden: false });

    expect(hiddenScenes(store)).toEqual([]);
  });

  it('warns when it shows scenes under a graphic that keeps the captions off its shot', async () => {
    const store = captionedProject();
    const hook = { id: 'hook', graphic: { ...new BuiltinGraphicPresetCatalog().starter().graphic, hidesCaptions: true } };
    store.patch({ shots: ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [hook] }, { id: 'b', startSec: 1.5, layers: [] }] }) });

    const shown = await operationOn(store).run({ segments: ['segment:s1', 'segment:s2'], hidden: false });
    const hidden = await operationOn(store).run({ segments: ['segment:s1'], hidden: true });

    expect(shown.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('segment:s1 now show') })]);
    expect(shown.problems[0]!.message).not.toContain('segment:s2');
    expect(hidden.problems).toEqual([]);
  });

  it('changes nothing when one of the scenes is gone', async () => {
    const store = captionedProject();
    const before = store.snapshot();

    const result = await operationOn(store).run({ segments: ['segment:s1', 'segment:gone'], hidden: true });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});
