import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimeFragment, type DecodedVideoFrame } from '@tscaps/engine';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import { ActorMaskTopLayerSource } from '@core/person-segmentation/infrastructure/ActorMaskTopLayerSource';

/**
 * Which moment of the video the actor cutout shows.
 *
 * The export gathers a run of frames before compositing any of them —
 * around twenty when a caption reads the video — and asks the top layer
 * for every frame of the run first. A cutout painted when it was asked
 * for leaves every frame of the run drawing the last one's actor: the
 * actor holds still for a run and jumps to the next.
 *
 * The canvases here only record what was drawn into them, which is all
 * the question needs: which frame and which mask end up in the cutout a
 * given frame composites.
 */

class RecordingContext {
  globalCompositeOperation = 'source-over';
  /** The latest frame and mask painted into this canvas. */
  frame: string | null = null;
  mask: number | null = null;

  constructor(private readonly owner: RecordingCanvas) {}

  clearRect(): void {
    this.frame = null;
    this.mask = null;
  }

  drawImage(source: RecordingCanvas): void {
    if (source.context.mask !== null) this.mask = source.context.mask;
    this.owner.drawnFrom.push(source);
  }

  createImageData(width: number, height: number): { data: Uint8ClampedArray } {
    return { data: new Uint8ClampedArray(width * height * 4) };
  }

  putImageData(image: { data: Uint8ClampedArray }): void {
    // A mask is told apart by the opacity of its first pixel.
    this.mask = image.data[3]!;
  }
}

class RecordingCanvas {
  readonly context: RecordingContext = new RecordingContext(this);
  readonly drawnFrom: RecordingCanvas[] = [];

  constructor(readonly width: number, readonly height: number) {}

  getContext(): RecordingContext {
    return this.context;
  }
}

function frameAt(name: string, timestamp: number): DecodedVideoFrame {
  return {
    timestamp,
    duration: 1 / 30,
    draw: (context) => { (context as unknown as RecordingContext).frame = name; },
    close: () => {},
  };
}

function maskWithOpacity(t: number, opacity: number) {
  return { t, alpha: new Uint8Array([opacity]), width: 1, height: 1 };
}

const realOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

beforeEach(() => { (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = RecordingCanvas; });
afterEach(() => { (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = realOffscreenCanvas; });

describe('a run of frames asked for before any is composited', () => {
  it('composites each frame with its own actor and its own mask', async () => {
    const masks = new MaskCache();
    masks.add(maskWithOpacity(0, 10));
    masks.add(maskWithOpacity(1, 20));
    const source = new ActorMaskTopLayerSource(masks, [new TimeFragment(0, 2)]);
    await source.open(4, 4);

    const first = await source.frameAt(0, frameAt('first', 0));
    const second = await source.frameAt(1, frameAt('second', 1));

    const target = new RecordingCanvas(4, 4);
    first!.draw(target.context as unknown as CanvasRenderingContext2D, 0, 0, 4, 4);
    const cutout = target.drawnFrom[0]!.context;
    expect([cutout.frame, cutout.mask]).toEqual(['first', 10]);

    second!.draw(target.context as unknown as CanvasRenderingContext2D, 0, 0, 4, 4);
    expect([cutout.frame, cutout.mask]).toEqual(['second', 20]);
  });
});
