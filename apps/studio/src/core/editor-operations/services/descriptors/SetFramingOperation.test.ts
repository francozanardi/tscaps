import { describe, expect, it } from 'vitest';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { SetFramingOperation } from '@core/editor-operations/services/descriptors/SetFramingOperation';
import { SplitShotsOperation } from '@core/editor-operations/services/descriptors/SplitShotsOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ShotAimPoint } from '@core/shots/services/ShotAimPoint';
import { ShotPictureArea } from '@core/shots/services/ShotPictureArea';

/**
 * Shots framed by a program: the point of the source picture each one
 * centres, alike on every shot listed, held with no camera at the frame's
 * closeness and with a punch-in closer, a camera move replaced and named.
 */

// A 9:16 frame of a 16:9 picture shows 9/16 × 9/16 of its width at the frame's closeness.
const WHOLE_SIDE = (9 / 16) * (9 / 16);

function verticalFixture(): ShotOperationsFixture {
  const fixture = new ShotOperationsFixture();
  fixture.store.patch({
    video: { ...fixture.store.snapshot().video, layout: { width: 1920, height: 1080 } },
    outputFrame: OutputFrame.original().withFormat('9:16'),
  });
  return fixture;
}

function operationOn(fixture: ShotOperationsFixture): SetFramingOperation {
  return new SetFramingOperation(
    fixture.store, fixture.shotRefs, fixture.animations, fixture.animationWriter, fixture.actions.setCamera,
    new ShotPictureArea(fixture.animations), new ShotAimPoint(),
  );
}

function cameraOf(fixture: ShotOperationsFixture, shotId: string): ShotCamera {
  const style = fixture.store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shotId));
  const animation = style?.animations?.[ElementAnimationScope.CAMERA];
  return ShotCamera.of(style?.fields, animation, animation?.presetId ? fixture.animations.byId(animation.presetId) : null);
}

/** The point across the picture a framing at the frame's closeness puts in the middle. */
function pointOf(share: number | null): number | null {
  return share === null ? null : share * (1 - WHOLE_SIDE) + WHOLE_SIDE / 2;
}

describe('set_framing', () => {
  it('centres the same point of the picture on every shot listed, with no camera at the frame\'s closeness', async () => {
    const fixture = verticalFixture();
    const [first, second] = [fixture.shot(0), fixture.shot(1)];

    const result = await operationOn(fixture).run({ shots: [first.ref, second.ref], x: 0.8 });

    expect(result.ok).toBe(true);
    for (const shot of [first, second]) {
      const camera = cameraOf(fixture, shot.shot.id);
      expect(camera.presetId).toBeNull();
      expect(pointOf(camera.start.x)).toBeCloseTo(0.8, 3);
    }
    expect(result.output).toMatchObject({ framed: [first.ref, second.ref], shows: '64% to 96% of the picture\'s width, 0% to 100% of its height' });
  });

  it('keeps the point as it is along the axis the frame shows whole, where a later zoom closes in', async () => {
    const fixture = verticalFixture();
    const shot = fixture.shot(0);

    const result = await operationOn(fixture).run({ shots: [shot.ref], x: 0.8, y: 0.3 });

    const camera = cameraOf(fixture, shot.shot.id);
    expect(pointOf(camera.start.x)).toBeCloseTo(0.8, 3);
    expect(camera.start.y).toBeCloseTo(0.3, 3);
    expect(result.output).toMatchObject({ shows: '64% to 96% of the picture\'s width, 0% to 100% of its height' });
  });

  it('holds a closer framing with a punch-in, aimed at the point on both axes', async () => {
    const fixture = verticalFixture();
    const shot = fixture.shot(0);

    await operationOn(fixture).run({ shots: [shot.ref], x: 0.2, y: 0.3, scale: 1.5 });

    const camera = cameraOf(fixture, shot.shot.id);
    expect(camera.presetId).toBe('layer-punch-in-camera');
    expect(camera.start.scale).toBe(1.5);
    expect(camera.moves()).toBe(false);
    // At 1.5 the view is two thirds of the picture tall: centred at 0.3, it starts at the top.
    expect(camera.start.y).toBe(0);
  });

  it('replaces a camera move a shot had, and says so', async () => {
    const fixture = verticalFixture();
    const shot = fixture.shot(0);
    fixture.actions.setCamera.pick({ kind: 'shot', shotId: shot.shot.id }, 'layer-zoom-in-camera');

    const result = await operationOn(fixture).run({ shots: [shot.ref], x: 0.5 });

    expect(cameraOf(fixture, shot.shot.id).presetId).toBeNull();
    expect(result.problems.map((problem) => problem.message)).toEqual([expect.stringContaining('layer-zoom-in-camera')]);
  });

  it('refuses a shot that is gone, framing nothing', async () => {
    const fixture = verticalFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ shots: [fixture.shot(0).ref, 'shot:gone'], x: 0.5 });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('keeps the framing on both halves when a framed shot is split', async () => {
    const fixture = verticalFixture();
    const shot = fixture.shotRefs.shotAt(6.25)!;
    await operationOn(fixture).run({ shots: [shot.ref], x: 0.3 });
    const split = new SplitShotsOperation(
      fixture.store, fixture.shotRefs, fixture.parser, fixture.wordOpenings, fixture.actions.split,
      new MoveShotStartAction(fixture.store, fixture.materializer, fixture.telemetry.edits), { read: async () => [] },
    );

    await split.run({ atSec: [6.25] });

    const opened = fixture.shotRefs.shotAt(6.25)!.shot;
    const drawn = new ShotPictureArea(fixture.animations).cameraOf(fixture.store.snapshot(), opened.id);
    expect(opened.id).not.toBe(shot.shot.id);
    expect(pointOf(drawn.start.x)).toBeCloseTo(0.3, 3);
  });
});
