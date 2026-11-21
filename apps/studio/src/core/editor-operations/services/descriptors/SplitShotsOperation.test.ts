import { describe, expect, it } from 'vitest';
import { SplitShotsOperation } from '@core/editor-operations/services/descriptors/SplitShotsOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

function operationOn(fixture: ShotOperationsFixture, cameraChangesSec: ReadonlyArray<number> = []): SplitShotsOperation {
  const pictureChanges: PictureChangeReader = { read: async () => cameraChangesSec };
  return new SplitShotsOperation(
    fixture.store, fixture.shotRefs, fixture.parser, fixture.wordOpenings, fixture.actions.split,
    new MoveShotStartAction(fixture.store, fixture.materializer, fixture.telemetry.edits), pictureChanges,
  );
}

describe('split_shots', () => {
  it('opens a shot at each time and answers it by the ref it now has', async () => {
    const fixture = new ShotOperationsFixture();

    const result = await operationOn(fixture).run({ atSec: [13.5, 6.25] });

    const shots = fixture.store.snapshot().shots;
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({
      opened: [
        { atSec: 13.5, shot: `shot:${shots.at(13.5)?.id}`, follows: `shot:${shots.at(13.4)?.id}` },
        { atSec: 6.25, shot: `shot:${shots.at(6.25)?.id}`, follows: `shot:${shots.at(6.2)?.id}` },
      ],
    });
    expect(shots.at(13.5)?.startSec).toBe(13.5);
    expect(shots.at(6.25)?.startSec).toBe(6.25);
  });

  it('says which shot each opened shot follows as the shots stand once every split is made', async () => {
    const fixture = new ShotOperationsFixture();
    const cut = fixture.shotRefs.shotAt(13.5)!;

    const result = await operationOn(fixture).run({ atSec: [cut.startSec + 2, cut.startSec + 1] });

    const [later, earlier] = (result.output as { opened: Array<{ shot: string; follows: string }> }).opened;
    expect(earlier!.follows).toBe(cut.ref);
    expect(later!.follows).toBe(earlier!.shot);
  });

  it('opens a shot on a word in the silence before it, as the editor does', async () => {
    const fixture = new ShotOperationsFixture();
    const word = fixture.store.snapshot().document!.getWords().find((each) => each.text === 'w5.')!;

    const result = await operationOn(fixture).run({ beforeWords: [`word:${word.id}`] });

    const opened = (result.output as { opened: Array<{ atSec: number; beforeWord: string }> }).opened;
    expect(result.ok).toBe(true);
    expect(opened).toHaveLength(1);
    expect(opened[0]!.beforeWord).toBe(`word:${word.id}`);
    // w4 ends at 9.5 s and w5 starts at 10 s: the shot opens between them, never inside a word.
    expect(opened[0]!.atSec).toBeGreaterThanOrEqual(9.5);
    expect(opened[0]!.atSec).toBeLessThanOrEqual(10);
  });

  it('refuses a word ref that names no word, and splits nothing', async () => {
    const fixture = new ShotOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ beforeWords: ['word:nope'], atSec: [9.5] });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('answers the shot that already opens where a split is asked, without an error or a split', async () => {
    const fixture = new ShotOperationsFixture();
    const word = fixture.store.snapshot().document!.getWords().find((each) => each.text === 'w5.')!;
    await operationOn(fixture).run({ beforeWords: [`word:${word.id}`] });
    const boundary = fixture.shot(1);
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ beforeWords: [`word:${word.id}`], atSec: [boundary.startSec + 0.05, 0.05] });

    const opening = fixture.store.snapshot().shots.list().find((shot) => shot.startSec >= 9.5 && shot.startSec <= 10)!;
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.output).toEqual({
      opened: [],
      alreadyOpen: [
        { atSec: opening.startSec, shot: `shot:${opening.id}`, beforeWord: `word:${word.id}` },
        { atSec: boundary.startSec, shot: boundary.ref },
        { atSec: 0, shot: fixture.shot(0).ref },
      ],
    });
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('refuses a time past the video or too close to its end, and still splits the others', async () => {
    const fixture = new ShotOperationsFixture();

    const result = await operationOn(fixture).run({ atSec: [30, 23.95, 9.5] });

    const opened = fixture.store.snapshot().shots.list().map((shot) => shot.startSec);
    expect(result.ok).toBe(true);
    expect(result.problems.filter((problem) => problem.severity === 'error')).toHaveLength(2);
    expect(opened).toContain(9.5);
    expect(opened).not.toContain(23.95);
  });

  it('leaves the project untouched when every time is refused', async () => {
    const fixture = new ShotOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ atSec: [-1, 24] });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('leaves the layers of the shot it cuts showing over both halves, and says how to end one at the split', async () => {
    const fixture = new ShotOperationsFixture();
    fixture.addFile('pic', 'image');
    const cut = fixture.shot(2);
    await fixture.actions.showFile.execute(cut.shot.id, 'pic', 'assistant');
    const [layer] = fixture.shot(2).shot.layers;

    const result = await operationOn(fixture).run({ atSec: [cut.startSec + 1] });

    const shots = fixture.store.snapshot().shots;
    const opened = shots.at(cut.startSec + 1)!;
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', ref: cut.ref, message: expect.stringContaining(`through: ${cut.ref}`) })]);
    expect(opened.layers).toEqual([]);
    expect(shots.runOf(layer!.id).map((shot) => shot.id)).toEqual([cut.shot.id, opened.id]);
  });

  it('refuses an input that is not a list of times', async () => {
    const fixture = new ShotOperationsFixture();

    const result = await operationOn(fixture).run({ atSec: [] });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('atSec');
  });

  it('opens a shot at each camera change, and moves an opening just next to one onto it', async () => {
    const fixture = new ShotOperationsFixture();
    await operationOn(fixture).run({ atSec: [13.5] });

    const result = await operationOn(fixture, [6.25, 13.7]).run({ atCameraChanges: true });

    const shots = fixture.store.snapshot().shots;
    expect(result.ok).toBe(true);
    expect(shots.at(6.25)?.startSec).toBe(6.25);
    expect(shots.at(13.7)?.startSec).toBe(13.7);
    expect(shots.list().some((shot) => shot.startSec === 13.5)).toBe(false);
    expect(result.output).toMatchObject({ opened: [{ atSec: 6.25 }], moved: [{ fromSec: 13.5, toSec: 13.7 }] });
  });

  it('keeps the camera move of a split shot running over both halves, and says how to end it at the split', async () => {
    const fixture = new ShotOperationsFixture();
    const shot = fixture.shotRefs.shotAt(6.25)!;
    fixture.actions.setCamera.pick({ kind: 'shot', shotId: shot.shot.id }, 'layer-zoom-in-camera');

    const result = await operationOn(fixture).run({ atSec: [6.25] });

    const shots = fixture.store.snapshot().shots;
    const opened = fixture.shotRefs.shotAt(6.25)!.shot;
    expect(opened.id).not.toBe(shot.shot.id);
    expect(shots.videoShotOf(opened.id)?.id).toBe(shot.shot.id);
    expect(shots.layerStyles.get(ShotVideoLayerId.of(opened.id))).toBeNull();
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining(`through: ${shot.ref}`) })]);
  });

  it('gives each half of a split shot its punch-in as its own, without a word', async () => {
    const fixture = new ShotOperationsFixture();
    const shot = fixture.shotRefs.shotAt(6.25)!;
    const target = { kind: 'shot', shotId: shot.shot.id } as const;
    fixture.actions.setCamera.pick(target, 'layer-punch-in-camera');
    fixture.actions.setCamera.setFraming(target, 'start', ShotVideoFraming.at(1.4, 0.2, 0.3));

    const result = await operationOn(fixture).run({ atSec: [6.25] });

    const shots = fixture.store.snapshot().shots;
    const opened = fixture.shotRefs.shotAt(6.25)!.shot;
    const style = shots.layerStyles.get(ShotVideoLayerId.of(opened.id));
    const camera = ShotCamera.of(style?.fields, style?.animations?.[ElementAnimationScope.CAMERA], fixture.animations.byId('layer-punch-in-camera'));
    expect(opened.id).not.toBe(shot.shot.id);
    expect(shots.videoShotOf(opened.id)?.id).toBe(opened.id);
    expect([camera.start.scale, camera.start.x, camera.start.y]).toEqual([1.4, 0.2, 0.3]);
    expect(style).toEqual(shots.layerStyles.get(ShotVideoLayerId.of(shot.shot.id)));
    expect(result.problems).toEqual([]);
  });

  it('gives each half of a split shot its framing as its own, without a word', async () => {
    const fixture = new ShotOperationsFixture();
    const shot = fixture.shotRefs.shotAt(6.25)!;
    fixture.actions.setCamera.place({ kind: 'shot', shotId: shot.shot.id }, 'start', 0.2, 0.3);

    const result = await operationOn(fixture).run({ atSec: [6.25] });

    const shots = fixture.store.snapshot().shots;
    const opened = fixture.shotRefs.shotAt(6.25)!.shot;
    expect(shots.videoShotOf(opened.id)?.id).toBe(opened.id);
    expect(shots.layerStyles.get(ShotVideoLayerId.of(opened.id))).toEqual(shots.layerStyles.get(ShotVideoLayerId.of(shot.shot.id)));
    expect(result.problems).toEqual([]);
  });
});
