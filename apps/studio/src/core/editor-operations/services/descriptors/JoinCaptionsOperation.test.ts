import { DocumentEditor } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import { JoinCaptionsOperation } from '@core/editor-operations/services/descriptors/JoinCaptionsOperation';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): JoinCaptionsOperation {
  const { store, parser, actions } = fixture;
  return new JoinCaptionsOperation(store, parser, new CaptionRefResolver(store, parser), new CaptionStructureEditor(new DocumentEditor()), actions.applyStructureEdit);
}

function scenesText(fixture: SheetOperationsFixture): string[] {
  return fixture.store.snapshot().document!.getSegments().map((segment) => segment.getWords().map((word) => word.text).join(' '));
}

describe('join_captions', () => {
  it('joins a caption with the one after it', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ segment: 'segment:s1' });

    expect(result.ok).toBe(true);
    expect(scenesText(fixture)).toEqual(['Hello world Again here', 'Bye']);
  });

  it('refuses the last caption', async () => {
    const fixture = new SheetOperationsFixture();

    expect((await operationOn(fixture).run({ segment: 'segment:s3' })).ok).toBe(false);
  });
});
