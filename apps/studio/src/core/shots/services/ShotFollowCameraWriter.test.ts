import { describe, expect, it } from 'vitest';
import type { FollowFraming } from '@core/shots/domain/StagedShotFollow';
import { ShotFollowCameraWriter } from '@core/shots/services/ShotFollowCameraWriter';

/**
 * How long a following camera's animation runs. The export reads a box
 * again on every frame its animations move, so a camera that holds one
 * framing runs out at once and stays on it; one that moves runs over the
 * box's whole stretch.
 */

const writer = new ShotFollowCameraWriter();

function cameraOf(framings: ReadonlyArray<FollowFraming>): string {
  const css = writer.write([{ selector: '.box', follow: { layerId: 'shot-video-a', framings } }]);
  return css.match(/--layer-camera-animation: ([^;]+);/)![1]!;
}

describe('ShotFollowCameraWriter', () => {
  it('runs a camera that holds one framing out at once, on that framing', () => {
    const camera = cameraOf([{ percent: 0, x: 0.4, y: null }]);

    expect(camera).toMatch(/^tscaps-shot-follow-0 1ms linear var\(--on-layer-starts\) 1 both$/);
  });

  it('runs a camera that moves over the box\'s whole stretch', () => {
    const camera = cameraOf([{ percent: 0, x: 0.2, y: null }, { percent: 100, x: 0.6, y: null }]);

    expect(camera).toMatch(/^tscaps-shot-follow-0 var\(--layer-duration\) linear/);
  });
});
