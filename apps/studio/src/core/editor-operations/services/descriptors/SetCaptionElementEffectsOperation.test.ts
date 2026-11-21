import { describe, expect, it } from 'vitest';
import { TimeFragment } from '@tscaps/engine';
import { SetBehindActorOverrideAction } from '@core/captions/actions/SetBehindActorOverrideAction';
import { DocumentElementDescendantResolver } from '@core/captions/services/DocumentElementDescendantResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SetElementBlendAction } from '@core/elements/actions/SetElementBlendAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { CaptionAncestorLocator } from '@core/editor-operations/services/CaptionAncestorLocator';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SetCaptionElementEffectsOperation } from '@core/editor-operations/services/descriptors/SetCaptionElementEffectsOperation';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { EnsureSegmentMasksCachedAction, EnsureSegmentMasksCachedInput } from '@core/person-segmentation/actions/EnsureSegmentMasksCachedAction';
import type { FootageCover, FootageCoverage } from '@core/person-segmentation/domain/FootageCoverage';
import { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';

const project = new CaptionOperationsTestProject();
const telemetry: Telemetry = { capture: () => {} };

/** Keeps the stretches it was asked to measure the person over, and measures nothing. */
class RecordingCutoutComputation {
  readonly asked: EnsureSegmentMasksCachedInput[] = [];

  execute(input: EnsureSegmentMasksCachedInput): Promise<void> {
    this.asked.push(input);
    return Promise.resolve();
  }
}

function captionedProject(options: { paintsVideoInside?: boolean } = {}): EditorStore {
  return project.store([project.sheet('main', project.template({ id: 'plain', ...options }))]);
}

/** Footage covering the stretches it is given, whatever the project holds. */
class FixedFootageCoverage implements FootageCoverage {
  constructor(private readonly given: ReadonlyArray<FootageCover>) {}

  covers(): ReadonlyArray<FootageCover> {
    return this.given;
  }
}

function operationOn(
  store: EditorStore,
  cutouts = new RecordingCutoutComputation(),
  covers: ReadonlyArray<FootageCover> = [],
): SetCaptionElementEffectsOperation {
  const parser = new EditorRefParser();
  return new SetCaptionElementEffectsOperation(
    new CaptionRefResolver(store, parser),
    new CaptionSceneLocator(),
    new CaptionAncestorLocator(),
    parser,
    store,
    new SetBehindActorOverrideAction(store, telemetry),
    cutouts as unknown as EnsureSegmentMasksCachedAction,
    new SetElementBlendAction(store, new DocumentElementDescendantResolver(store), project.inertRefresh()),
    new BehindActorGatingService(),
    new FixedFootageCoverage(covers),
    new MediaAssetStore(),
  );
}

describe('set_caption_element_effects: behind the person', () => {
  it('puts a word behind the person', async () => {
    const store = captionedProject();

    const result = await operationOn(store).run({ elements: ['word:w1'], behindPerson: 'on' });

    expect(result.ok).toBe(true);
    expect(store.snapshot().behindActorOverrides.get('w1')).toBe('force-on');
  });

  // The cutout lands in caches outside the project state, so asking for it
  // is the only trace an operation leaves of it.
  it('asks for the person cutout over the whole scene of a word put behind', async () => {
    const store = captionedProject();
    const cutouts = new RecordingCutoutComputation();

    const result = await operationOn(store, cutouts).run({ elements: ['word:w1', 'word:w2'], behindPerson: 'on' });

    expect(cutouts.asked).toEqual([{ segmentId: 's1', range: { start: 0, end: 1 } }]);
    // Waited for, so frames pictured after the answer show the effect.
    expect(result.output).toMatchObject({ cutout: 'ready' });
  });

  it('keeps a scene in front with "off", and gives a word back to none', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ elements: ['word:w1'], behindPerson: 'on' });

    await operation.run({ elements: ['segment:s2', 'word:w1'], behindPerson: 'off' });

    expect(store.snapshot().behindActorOverrides.get('s2')).toBe('force-off');
    expect(store.snapshot().behindActorOverrides.get('w1')).toBe('auto');
  });

  // A layer opening on the next shot can overlap a scene by a sliver nobody sees.
  it('refuses a scene a layer shows over at its very end, saying which layer and where, and changes nothing', async () => {
    const store = captionedProject();
    const before = store.snapshot();
    const brollFromNextShot = { layerId: 'b1', range: new TimeFragment(0.9, 4) };

    const result = await operationOn(store, undefined, [brollFromNextShot]).run({ elements: ['word:w1'], behindPerson: 'on' });

    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([expect.objectContaining({ ref: 'word:w1', message: expect.stringContaining('layer:b1') })]);
    expect(result.problems[0]!.message).toContain('0.90–1.00 s');
    expect(store.snapshot()).toBe(before);
  });

  it('puts a scene behind when the layers show only outside it', async () => {
    const store = captionedProject();
    const afterTheScene = { layerId: 'b1', range: new TimeFragment(1, 4) };

    const result = await operationOn(store, undefined, [afterTheScene]).run({ elements: ['segment:s1'], behindPerson: 'on' });

    expect(result.ok).toBe(true);
    expect(store.snapshot().behindActorOverrides.get('s1')).toBe('force-on');
  });

  it('refuses a word on a template that paints the video inside its captions, and changes nothing', async () => {
    const store = captionedProject({ paintsVideoInside: true });
    const before = store.snapshot();

    const result = await operationOn(store).run({ elements: ['word:w1'], behindPerson: 'on' });

    expect(result.ok).toBe(false);
    expect(store.snapshot()).toBe(before);
  });
});

describe('set_caption_element_effects: blend with video', () => {
  it('blends a line with the video, and takes it off again', async () => {
    const store = captionedProject();
    const operation = operationOn(store);

    const on = await operation.run({ elements: ['line:l1'], blendWithVideo: true });
    expect(on.output).toEqual({ changed: ['line:l1'] });
    expect(store.snapshot().elementStyles.blendOf('l1')).toBe('difference');

    await operation.run({ elements: ['line:l1'], blendWithVideo: false });
    expect(store.snapshot().elementStyles.blendOf('l1')).toBeNull();
  });

  it('leaves a word to the scene around it that already blends', async () => {
    const store = captionedProject();
    const operation = operationOn(store);

    await operation.run({ elements: ['segment:s1', 'word:w1'], blendWithVideo: true });

    expect(store.snapshot().elementStyles.blendOf('s1')).toBe('difference');
    expect(store.snapshot().elementStyles.blendOf('w1')).toBeNull();
  });

  it('refuses to take the blend off a word whose scene blends, and changes nothing', async () => {
    const store = captionedProject();
    const operation = operationOn(store);
    await operation.run({ elements: ['segment:s1'], blendWithVideo: true });
    const before = store.snapshot();

    const result = await operation.run({ elements: ['word:w1'], blendWithVideo: false });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('segment:s1');
    expect(store.snapshot()).toBe(before);
  });

  it('sets both effects in one call', async () => {
    const store = captionedProject();

    await operationOn(store).run({ elements: ['decoration:w2:d'], behindPerson: 'on', blendWithVideo: true });

    expect(store.snapshot().behindActorOverrides.get('w2:d')).toBe('force-on');
    expect(store.snapshot().elementStyles.blendOf('w2:d')).toBe('difference');
  });
});
