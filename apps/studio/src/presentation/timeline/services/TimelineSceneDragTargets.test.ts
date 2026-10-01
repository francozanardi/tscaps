import { describe, expect, it } from 'vitest';
import { Line, Segment, TimeFragment, Word } from '@tscaps/engine';
import { TimelineSceneDragTargets } from '@presentation/timeline/services/TimelineSceneDragTargets';
import { TimelineSceneExtentResolver } from '@presentation/timeline/services/TimelineSceneExtentResolver';

function sceneSaid(start: number, end: number): Segment {
  return new Segment({ lines: [new Line({ words: [new Word({ text: 'w', time: new TimeFragment(start, end) })] })] });
}

function targetsOf(segments: Segment[]): TimelineSceneDragTargets {
  return new TimelineSceneDragTargets(new TimelineSceneExtentResolver().resolve(segments));
}

describe('TimelineSceneDragTargets', () => {
  it('takes a scene onward with every drawn scene starting at the same instant or later', () => {
    const before = sceneSaid(0, 1);
    const from = sceneSaid(2, 3);
    const alongside = sceneSaid(2, 2.5);
    const after = sceneSaid(4, 5);
    const targets = targetsOf([after, before, from, alongside]);

    expect(targets.fromOnward(from.id)).toEqual(new Set([from.id, alongside.id, after.id]));
  });

  it('takes a scene back with every drawn scene starting at the same instant or earlier', () => {
    const before = sceneSaid(0, 1);
    const upTo = sceneSaid(2, 3);
    const alongside = sceneSaid(2, 2.5);
    const after = sceneSaid(4, 5);
    const targets = targetsOf([after, before, upTo, alongside]);

    expect(targets.upTo(upTo.id)).toEqual(new Set([before.id, upTo.id, alongside.id]));
  });

  it('takes nothing onward from a scene it is not drawing', () => {
    const targets = targetsOf([sceneSaid(0, 1)]);

    expect(targets.fromOnward('not-drawn').size).toBe(0);
  });

  it('hands scenes back in start order, leaving out any it is not drawing', () => {
    const first = sceneSaid(0, 1);
    const second = sceneSaid(2, 3);
    const targets = targetsOf([second, first]);

    const subjects = targets.subjectsFor(new Set([second.id, 'not-drawn', first.id]));

    expect(subjects.map((subject) => subject.segmentId)).toEqual([first.id, second.id]);
  });
});
