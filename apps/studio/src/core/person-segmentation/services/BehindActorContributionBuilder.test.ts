import { describe, expect, it } from 'vitest';
import { CssClass, Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { ExportRenderContext } from '@core/export/domain/ExportRenderContributor';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { BehindActorContributionBuilder } from '@core/person-segmentation/services/BehindActorContributionBuilder';
import { BehindActorGatingService } from '@core/person-segmentation/services/BehindActorGatingService';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';

/**
 * What the export is told about the actor cutout when the user put one
 * word behind the person instead of a whole scene.
 *
 * The word is painted under the cutout and the rest of its scene over
 * it, and nothing about the scene moves — the template's lift reacts to
 * the scene's own activation, which a word must not trigger.
 */

const NOT_OPTED_IN = { behindActor: { required: false, tagCondition: null } };

function contextWith(overrides: BehindActorOverrideRegistry): ExportRenderContext {
  const words = ['w1', 'w2', 'w3'].map((id, i) => new Word({
    id,
    text: id,
    time: new TimeFragment(i, i + 1),
    ...(id === 'w3' ? { decoration: new Decoration({ id: 'w3:d', glyph: '🔥' }) } : {}),
  }));
  const segment = new Segment({ id: 's1', lines: [new Line({ id: 'l1', words })] });
  return {
    document: new Document({ sections: [new Section({ id: 'sec', kind: 'main', segments: [segment] })] }),
    sheets: [{ id: 'main', template: NOT_OPTED_IN } as unknown as Sheet],
    behindActorOverrides: overrides,
    projectId: null,
  };
}

const builder = new BehindActorContributionBuilder(new BehindActorGatingService());
const result = new PersonSegmentationResultAssembler(new PassingWindowFinder())
  .assemble(TimeRangeSet.of([{ start: 0, end: 3 }]), [], new MaskCache());

describe('a word put behind the person on its own', () => {
  it('is painted under the cutout, with its scene marked as holding one rather than as lifted', () => {
    const contribution = builder.build(contextWith(BehindActorOverrideRegistry.empty().with('w2', 'force-on')), result);
    expect([...contribution.elementsUnderTopLayer]).toEqual(['w2']);
    expect(contribution.segmentClasses.get('s1')).toEqual([CssClass.BEHIND_ACTOR_PARTIAL]);
    expect(contribution.topLayer).not.toBeNull();
  });

  it('has nothing left to add once its scene is behind the person', () => {
    const overrides = BehindActorOverrideRegistry.empty().with('w2', 'force-on').with('s1', 'force-on');
    const contribution = builder.build(contextWith(overrides), result);
    expect(contribution.elementsUnderTopLayer.size).toBe(0);
    expect(contribution.segmentClasses.get('s1')).toEqual([CssClass.BEHIND_ACTOR_ACTIVE]);
  });

  it('is not put there by anything but the user', () => {
    const contribution = builder.build(contextWith(BehindActorOverrideRegistry.empty()), result);
    expect(contribution.elementsUnderTopLayer.size).toBe(0);
    expect(contribution.segmentClasses.size).toBe(0);
  });
});

describe('an emoji put behind the person on its own', () => {
  it('is painted under the cutout like a word, while its word stays in front', () => {
    const contribution = builder.build(contextWith(BehindActorOverrideRegistry.empty().with('w3:d', 'force-on')), result);
    expect([...contribution.elementsUnderTopLayer]).toEqual(['w3:d']);
    expect(contribution.segmentClasses.get('s1')).toEqual([CssClass.BEHIND_ACTOR_PARTIAL]);
  });
});
