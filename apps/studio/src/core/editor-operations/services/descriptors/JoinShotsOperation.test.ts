import { describe, expect, it } from 'vitest';
import { JoinShotsOperation } from '@core/editor-operations/services/descriptors/JoinShotsOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';

function operationOn(fixture: ShotOperationsFixture): JoinShotsOperation {
  return new JoinShotsOperation(fixture.store, fixture.shotRefs, fixture.parser, fixture.actions.join);
}

describe('join_shots', () => {
  it('joins each shot into the one before it, which keeps its ref and now runs over both', async () => {
    const fixture = new ShotOperationsFixture();
    const [first, second, third] = [fixture.shot(1), fixture.shot(2), fixture.shot(3)];

    const result = await operationOn(fixture).run({ shots: [third.ref, second.ref] });

    const ids = fixture.store.snapshot().shots.list().map((shot) => shot.id);
    expect(result.ok).toBe(true);
    expect(ids).toContain(first.shot.id);
    expect(ids).not.toContain(second.shot.id);
    expect(ids).not.toContain(third.shot.id);
    expect(fixture.shot(1).endSec).toBe(third.endSec);
    expect(result.output).toMatchObject({ joined: [{ shot: second.ref, into: first.ref }, { shot: third.ref, into: first.ref }] });
  });

  it('moves the joined shot\'s layers onto the shot before it, and says so', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const [before, joined] = [fixture.shot(1), fixture.shot(2)];
    await fixture.actions.showFile.execute(joined.shot.id, 'pic', 'assistant');
    const layerId = fixture.shot(2).shot.layers[0]!.id;

    const result = await operationOn(fixture).run({ shots: [joined.ref] });

    expect(fixture.store.snapshot().shots.shotHolding(layerId)?.id).toBe(before.shot.id);
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', ref: joined.ref })]);
  });

  it('joins nothing when one ref is the first shot or gone', async () => {
    const fixture = new ShotOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ shots: [fixture.shot(2).ref, fixture.shot(0).ref, 'shot:gone'] });

    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(2);
    expect(fixture.store.snapshot()).toBe(before);
  });
});
