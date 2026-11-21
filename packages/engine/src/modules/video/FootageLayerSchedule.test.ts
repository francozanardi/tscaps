import { describe, expect, it } from 'vitest';
import type { FootageLayer } from '@modules/video/FootageLayer';
import { FootageLayerSchedule } from '@modules/video/FootageLayerSchedule';

/**
 * A layer covers its stretch and nothing past it, layers covering one
 * moment come back in the order they were given, and a video runs with
 * the output from where it was asked to start, starting over at the end
 * of each pass. An image has one pass and no moments; a GIF has one
 * pass and moments that run on, since it loops by its own length. The
 * source's own picture is drawn, not played: one pass, no moments.
 * Provided pictures are asked like a GIF's: one pass, moments that run on.
 */

function layer(outputStartSec: number, outputEndSec: number, sourceStartSec = 0, sourcePassSec = Infinity): FootageLayer {
  return {
    id: `${outputStartSec}-${outputEndSec}`,
    source: { kind: 'video', blob: new Blob() },
    outputStartSec,
    outputEndSec,
    sourceStartSec,
    sourcePassSec,
  };
}

function image(outputStartSec: number, outputEndSec: number): FootageLayer {
  return { ...layer(outputStartSec, outputEndSec, 0, 0), source: { kind: 'image', blob: new Blob() } };
}

describe('FootageLayerSchedule', () => {
  it('finds the layers covering a moment, and none at their end or between them', () => {
    const first = layer(2, 4);
    const second = layer(6, 8);
    const schedule = new FootageLayerSchedule([second, first]);

    expect(schedule.layersAt(1.9)).toEqual([]);
    expect(schedule.layersAt(2)).toEqual([first]);
    expect(schedule.layersAt(3.99)).toEqual([first]);
    expect(schedule.layersAt(4)).toEqual([]);
    expect(schedule.layersAt(7)).toEqual([second]);
  });

  it('answers layers covering one moment in the order they were given, bottom to top', () => {
    const top = layer(0, 10);
    const bottom = layer(2, 5);
    const schedule = new FootageLayerSchedule([bottom, top]);

    expect(schedule.layersAt(3)).toEqual([bottom, top]);
    expect(schedule.layersAt(6)).toEqual([top]);
  });

  it('runs the video with the output from where it starts', () => {
    const schedule = new FootageLayerSchedule([]);

    expect(schedule.sourceTimeAt(layer(10, 20, 1.5), 13)).toBe(4.5);
  });

  it('starts the video over at the end of each pass', () => {
    const schedule = new FootageLayerSchedule([]);
    const looped = layer(10, 20, 1, 2);

    expect(schedule.sourceTimeAt(looped, 11.5)).toBe(2.5);
    expect(schedule.sourceTimeAt(looped, 12)).toBe(1);
    expect(schedule.sourceTimeAt(looped, 14.5)).toBe(1.5);
  });

  it('names the pass of each layer covering a moment', () => {
    const looped = layer(10, 15, 1, 2);
    const over = layer(11, 13);
    const schedule = new FootageLayerSchedule([looped, over]);

    expect(schedule.passesAt(12.5)).toEqual([
      { layer: looped, outputStartSec: 12, outputEndSec: 14 },
      { layer: over, outputStartSec: 11, outputEndSec: 13 },
    ]);
    expect(schedule.passesAt(14)).toEqual([{ layer: looped, outputStartSec: 14, outputEndSec: 15 }]);
  });

  it('names the next pass to start, whether a layer starting over or another layer opening', () => {
    const looped = layer(10, 15, 1, 2);
    const later = layer(20, 22);
    const sooner = layer(11, 12);
    const schedule = new FootageLayerSchedule([later, looped, sooner]);

    expect(schedule.nextPassAfter(5)).toEqual({ layer: looped, outputStartSec: 10, outputEndSec: 12 });
    expect(schedule.nextPassAfter(10)).toEqual({ layer: sooner, outputStartSec: 11, outputEndSec: 12 });
    expect(schedule.nextPassAfter(11)).toEqual({ layer: looped, outputStartSec: 12, outputEndSec: 14 });
    expect(schedule.nextPassAfter(14)).toEqual({ layer: later, outputStartSec: 20, outputEndSec: 22 });
    expect(schedule.nextPassAfter(20)).toBeNull();
  });

  it('holds an image for its whole stretch as a single pass', () => {
    const still = image(3, 9);
    const schedule = new FootageLayerSchedule([still]);

    expect(schedule.passesAt(8)).toEqual([{ layer: still, outputStartSec: 3, outputEndSec: 9 }]);
    expect(schedule.nextPassAfter(4)).toBeNull();
  });

  it('plays a GIF as a single pass whose moment runs on from where it starts, never starting over', () => {
    const gif: FootageLayer = { ...layer(3, 9, 0.5, 0), source: { kind: 'gif', blob: new Blob() } };
    const schedule = new FootageLayerSchedule([gif]);

    expect(schedule.passesAt(8)).toEqual([{ layer: gif, outputStartSec: 3, outputEndSec: 9 }]);
    expect(schedule.sourceTimeAt(gif, 7)).toBe(4.5);
  });

  it('asks provided pictures as a single pass whose moment runs on from where it starts', () => {
    const provided: FootageLayer = {
      ...layer(3, 9, 0.5, 0),
      source: { kind: 'provided', provider: { open: () => Promise.reject(new Error('Not opened here')) } },
    };
    const schedule = new FootageLayerSchedule([provided]);

    expect(schedule.passesAt(8)).toEqual([{ layer: provided, outputStartSec: 3, outputEndSec: 9 }]);
    expect(schedule.sourceTimeAt(provided, 7)).toBe(4.5);
  });

  it('ignores a layer covering nothing', () => {
    const schedule = new FootageLayerSchedule([layer(3, 3), layer(4, 5, 0, 0), image(6, 6)]);

    expect(schedule.isEmpty()).toBe(true);
  });

  it('gives a layer showing the source\'s own picture one pass over its stretch, whatever its pass length', () => {
    const own: FootageLayer = { ...layer(1, 5, 2, 0), source: { kind: 'source-picture' } };
    const schedule = new FootageLayerSchedule([own]);

    expect(schedule.passesAt(3)).toEqual([{ layer: own, outputStartSec: 1, outputEndSec: 5 }]);
    expect(schedule.sourceTimeAt(own, 4)).toBe(2);
  });
});

