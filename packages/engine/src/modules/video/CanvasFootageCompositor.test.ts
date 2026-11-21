import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasFootageCompositor } from '@modules/video/CanvasFootageCompositor';
import type { FootageLayerPicture } from '@modules/video/FootageCompositor';
import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootagePicture } from '@modules/video/FootagePicture';
import type { FootageRect } from '@modules/video/FootageRect';

/**
 * What a composed frame is painted from, where, and clipped to what.
 *
 * The source's picture lies beneath, whole, unless a layer re-frames
 * it — then it covers that layer's video rect over a black frame. Each
 * layer lands in its rect, bottom to top. A video covering the whole
 * frame square-cornered paints exactly what a full-frame cover always
 * has: the picture scaled to cover, centred, with nothing beneath it.
 * A layer whose state moves it is drawn that way — faded, transformed
 * about its rect's centre, blurred or cut by an inset, its clip moving
 * with it — and hides nothing beneath it. A layer showing the source's
 * own picture is the only place that picture is drawn, over black.
 */

const WIDTH = 720;
const HEIGHT = 1280;
const WHOLE: FootageRect = { x: 0, y: 0, width: 1, height: 1 };

interface Painted {
  readonly what: string;
  readonly at: readonly number[];
  readonly clip: string | null;
  /** Present only when the picture is drawn less than opaque. */
  readonly alpha?: number;
  /** Present only when the picture is turned: clockwise degrees, and where its own centre lands. */
  readonly rotationDeg?: number;
  readonly centre?: readonly number[];
  /** Present only when the picture is filtered. */
  readonly filter?: string;
}

interface ContextState {
  readonly clip: string | null;
  readonly alpha: number;
  readonly filter: string;
  readonly matrix: readonly number[];
}

/**
 * Stands in for a 2D context: it keeps the clips in force (joined by
 * `&`, since each one narrows the last), the opacity, the filter, the
 * transform and the fills, and nothing else. Everything it logs is in
 * frame pixels, after the transform; a box is logged by its mapped
 * top-left corner and its scaled size.
 */
class RecordingContext {
  readonly log: Array<Painted | string> = [];
  fillStyle = '';
  globalAlpha = 1;
  filter = 'none';
  clipInForce: string | null = null;
  /** The frame being drawn on, as a backdrop layer takes it up. */
  readonly canvas = { width: WIDTH, height: HEIGHT, what: 'frame' };
  // a, b, c, d, e, f as in DOMMatrix: x' = a·x + c·y + e, y' = b·x + d·y + f.
  private matrix: readonly number[] = [1, 0, 0, 1, 0, 0];
  private path: string | null = null;
  private readonly saved: ContextState[] = [];

  save(): void {
    this.saved.push({ clip: this.clipInForce, alpha: this.globalAlpha, filter: this.filter, matrix: this.matrix });
  }
  restore(): void {
    const state = this.saved.pop();
    if (!state) return;
    this.clipInForce = state.clip;
    this.globalAlpha = state.alpha;
    this.filter = state.filter;
    this.matrix = state.matrix;
  }
  translate(x: number, y: number): void {
    this.multiply([1, 0, 0, 1, x, y]);
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.multiply([a, b, c, d, e, f]);
  }
  beginPath(): void { this.path = null; }
  rect(x: number, y: number, width: number, height: number): void { this.path = `rect ${this.mapped(x, y, width, height).join(',')}`; }
  roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.path = `round ${this.mapped(x, y, width, height).join(',')} r${radius * this.scaleInForce()}`;
  }
  clip(): void { this.clipInForce = this.clipInForce === null ? this.path : `${this.clipInForce} & ${this.path}`; }
  fillRect(x: number, y: number, width: number, height: number): void {
    this.log.push(`fill ${this.fillStyle} ${this.mapped(x, y, width, height).join(',')}`);
  }
  drawImage(source: { what: string }, x: number, y: number, width: number, height: number): void {
    this.paint(source.what, x, y, width, height);
  }
  paint(what: string, x: number, y: number, width: number, height: number): void {
    const rotationDeg = (Math.atan2(this.matrix[1]!, this.matrix[0]!) * 180) / Math.PI;
    const painted: Painted = {
      what,
      at: this.mapped(x, y, width, height),
      clip: this.clipInForce,
      ...(this.globalAlpha === 1 ? {} : { alpha: this.globalAlpha }),
      ...(Math.abs(rotationDeg) < 1e-9 ? {} : { rotationDeg, centre: this.point(x + width / 2, y + height / 2) }),
      ...(this.filter === 'none' ? {} : { filter: this.filter }),
    };
    this.log.push(painted);
  }

  private multiply(next: readonly number[]): void {
    const [a, b, c, d, e, f] = this.matrix as [number, number, number, number, number, number];
    const [na, nb, nc, nd, ne, nf] = next as [number, number, number, number, number, number];
    this.matrix = [
      a * na + c * nb,
      b * na + d * nb,
      a * nc + c * nd,
      b * nc + d * nd,
      a * ne + c * nf + e,
      b * ne + d * nf + f,
    ];
  }

  private point(x: number, y: number): number[] {
    const [a, b, c, d, e, f] = this.matrix as [number, number, number, number, number, number];
    return [a * x + c * y + e, b * x + d * y + f];
  }

  private scaleInForce(): number {
    return Math.hypot(this.matrix[0]!, this.matrix[1]!);
  }

  private mapped(x: number, y: number, width: number, height: number): number[] {
    return [...this.point(x, y), this.scaleInForce() * width, this.scaleInForce() * height];
  }
}

function picture(what: string): FootagePicture {
  return {
    draw: (context, dx, dy, dWidth, dHeight) => {
      (context as unknown as RecordingContext).paint(what, dx, dy, dWidth, dHeight);
    },
  };
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
// Nothing composed here carries a grade.
const NO_GRADER = { grade: () => undefined };

function entry(
  what: string,
  state: Partial<FootageLayerFrameState> & { kind?: 'video' | 'image' | 'source-picture' | 'backdrop' },
  width = 1920,
  height = 1080,
): FootageLayerPicture {
  const layer: FootageLayer = {
    id: what,
    source: state.kind === 'source-picture' || state.kind === 'backdrop' ? { kind: state.kind } : { kind: state.kind ?? 'video', blob: new Blob() },
    outputStartSec: 0,
    outputEndSec: 1,
    sourceStartSec: 0,
    sourcePassSec: Infinity,
  };
  return {
    layer,
    picture: picture(what),
    width,
    height,
    state: {
      assetRect: state.assetRect ?? WHOLE,
      fit: state.fit ?? 'cover',
      position: state.position ?? { x: { share: 0.5, offset: 0 }, y: { share: 0.5, offset: 0 } },
      cornerRadius: state.cornerRadius ?? 0,
      opacity: state.opacity ?? 1,
      transform: state.transform ?? IDENTITY,
      blur: state.blur ?? 0,
      brightness: state.brightness ?? 1,
      backgroundColor: state.backgroundColor ?? null,
      clipInset: state.clipInset ?? { top: 0, right: 0, bottom: 0, left: 0 },
      videoRect: state.videoRect ?? null,
      videoAbove: state.videoAbove ?? false,
      videoCornerRadius: state.videoCornerRadius ?? 0,
      fillBlur: state.fillBlur ?? 0,
      clipRect: state.clipRect ?? null,
      clipRadius: state.clipRadius ?? 0,
    },
  };
}

function compose(layers: FootageLayerPicture[], videoWidth = WIDTH, videoHeight = HEIGHT): Array<Painted | string> {
  const context = new RecordingContext();
  new CanvasFootageCompositor(NO_GRADER).compose(context as unknown as CanvasRenderingContext2D, {
    width: WIDTH,
    height: HEIGHT,
    video: picture('video'),
    videoWidth,
    videoHeight,
    layers,
  });
  return context.log;
}

describe('a composed frame', () => {
  it('under a full-frame cover video, is that video alone, scaled to cover and centred', () => {
    const scale = Math.max(WIDTH / 1920, HEIGHT / 1080);
    const drawnWidth = 1920 * scale;
    const drawnHeight = 1080 * scale;

    expect(compose([entry('below', {}), entry('footage', {})])).toEqual([
      { what: 'footage', at: [(WIDTH - drawnWidth) / 2, (HEIGHT - drawnHeight) / 2, drawnWidth, drawnHeight], clip: null },
    ]);
  });

  it('shows the video whole beneath layers that leave some of it showing, then each layer bottom to top', () => {
    const painted = compose([
      entry('inset', { assetRect: { x: 0.5, y: 0.5, width: 0.5, height: 0.25 }, fit: 'contain' }, 400, 400),
      entry('logo', { assetRect: { x: 0, y: 0, width: 0.25, height: 0.25 }, kind: 'image' }, 100, 100),
    ]);

    expect(painted).toEqual([
      { what: 'video', at: [0, 0, 720, 1280], clip: null },
      { what: 'inset', at: [380, 640, 320, 320], clip: 'rect 380,640,320,320' },
      { what: 'logo', at: [-70, 0, 320, 320], clip: 'rect 0,0,180,320' },
    ]);
  });

  it('fills the box around a picture fitted inside it with its colour, beneath the picture', () => {
    const painted = compose([
      entry('inset', { assetRect: { x: 0.5, y: 0.5, width: 0.5, height: 0.25 }, fit: 'contain', backgroundColor: 'rgb(0, 0, 0)' }, 400, 400),
    ]);

    expect(painted).toEqual([
      { what: 'video', at: [0, 0, 720, 1280], clip: null },
      'fill rgb(0, 0, 0) 360,640,360,320',
      { what: 'inset', at: [380, 640, 320, 320], clip: 'rect 360,640,360,320' },
    ]);
  });

  it('fills the box around a picture fitted inside it with the picture itself, covering it, blurred and a little grown', () => {
    // Covering the 360×320 box, a tenth larger.
    const grown = 400 * Math.max(360 / 400, 320 / 400) * 1.1;
    const painted = compose([
      entry('inset', { assetRect: { x: 0.5, y: 0.5, width: 0.5, height: 0.25 }, fit: 'contain', fillBlur: 0.02 }, 400, 400),
    ]);

    expect(painted).toEqual([
      { what: 'video', at: [0, 0, 720, 1280], clip: null },
      { what: 'inset', at: [360 + (360 - grown) / 2, 640 + (320 - grown) / 2, grown, grown], clip: 'rect 360,640,360,320', filter: 'blur(14.4px)' },
      { what: 'inset', at: [380, 640, 320, 320], clip: 'rect 360,640,360,320' },
    ]);
  });

  it('fills nothing around a picture that covers its box', () => {
    const painted = compose([
      entry('inset', { assetRect: { x: 0.5, y: 0.5, width: 0.5, height: 0.25 }, backgroundColor: 'rgb(0, 0, 0)', fillBlur: 0.02 }, 400, 400),
    ]);

    expect(painted).toEqual([
      { what: 'video', at: [0, 0, 720, 1280], clip: null },
      { what: 'inset', at: [360, 620, 360, 360], clip: 'rect 360,640,360,320' },
    ]);
  });

  it('cuts a layer grown past its clip rect to that rect, its corners rounded', () => {
    // A box twice the clip's size, centred on it: what the clip shows is the middle of the picture.
    const painted = compose([entry('inset', {
      assetRect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      clipRect: { x: 0.375, y: 0.375, width: 0.25, height: 0.25 },
      clipRadius: 0.05,
    }, 360, 640)]);

    expect(painted[1]).toEqual({ what: 'inset', at: [180, 320, 360, 640], clip: 'rect 180,320,360,640 & round 270,480,180,320 r36' });
  });

  it('moves a clip rect with the layer it cuts', () => {
    const painted = compose([entry('inset', {
      assetRect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      clipRect: { x: 0.375, y: 0.375, width: 0.25, height: 0.25 },
      transform: { ...IDENTITY, e: 0.1 },
    }, 360, 640)]);

    expect(painted[1]).toEqual({ what: 'inset', at: [252, 320, 360, 640], clip: 'rect 252,320,360,640 & rect 342,480,180,320' });
  });

  it('keeps the video beneath an image over the whole frame, which may be transparent', () => {
    const painted = compose([entry('overlay', { kind: 'image' }, WIDTH, HEIGHT)]);

    expect(painted).toEqual([
      { what: 'video', at: [0, 0, 720, 1280], clip: null },
      { what: 'overlay', at: [0, 0, 720, 1280], clip: null },
    ]);
  });

  it('rounds the corners of a layer by a fraction of the frame\'s shorter side', () => {
    const painted = compose([entry('inset', { assetRect: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, cornerRadius: 0.05 }, 360, 640)]);

    expect(painted[1]).toEqual({ what: 'inset', at: [72, 128, 360, 640], clip: 'round 72,128,360,640 r36' });
  });

  it('re-frames the video to cover a layer\'s video rect over black, before the layer', () => {
    const topHalf = { x: 0, y: 0, width: 1, height: 0.5 };
    const bottomHalf = { x: 0, y: 0.5, width: 1, height: 0.5 };

    expect(compose([entry('footage', { assetRect: topHalf, videoRect: bottomHalf }, 720, 640)])).toEqual([
      'fill #000000 0,0,720,1280',
      { what: 'video', at: [0, 320, 720, 1280], clip: 'rect 0,640,720,640' },
      { what: 'footage', at: [0, 0, 720, 640], clip: 'rect 0,0,720,640' },
    ]);
  });

  it('re-frames the video by the topmost layer carrying a video rect', () => {
    const lower = { x: 0, y: 0, width: 1, height: 0.5 };
    const upper = { x: 0, y: 0.5, width: 1, height: 0.5 };
    const corner = { x: 0, y: 0, width: 0.1, height: 0.1 };
    const painted = compose([
      entry('lower', { assetRect: corner, videoRect: lower }, 72, 128),
      entry('upper', { assetRect: corner, videoRect: upper }, 72, 128),
    ]);

    expect(painted[1]).toMatchObject({ what: 'video', clip: 'rect 0,640,720,640' });
  });
});

describe('a composed frame with a layer out of its rest', () => {
  const inset = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

  it('fades a full-frame cover video over the video beneath it, which shows through', () => {
    const painted = compose([entry('footage', { opacity: 0.25 }, WIDTH, HEIGHT)]);

    expect(painted).toEqual([
      { what: 'video', at: [0, 0, 720, 1280], clip: null },
      { what: 'footage', at: [0, 0, 720, 1280], clip: 'rect 0,0,720,1280', alpha: 0.25 },
    ]);
  });

  it('draws the layers beneath a full-frame cover that is moved', () => {
    const painted = compose([
      entry('below', { assetRect: inset }, 360, 640),
      entry('footage', { transform: { ...IDENTITY, e: 0.5 } }, WIDTH, HEIGHT),
    ]);

    expect(painted.map((paint) => (typeof paint === 'string' ? paint : paint.what))).toEqual(['video', 'below', 'footage']);
  });

  it('scales a layer about the centre of its rect, its rounded clip shrinking with it', () => {
    const scale = 0.75;
    const scaled = { ...IDENTITY, a: scale, d: scale };
    const painted = compose([entry('inset', { assetRect: inset, cornerRadius: 0.05, opacity: 0.5, transform: scaled }, 360, 640)]);
    const grown = painted[1] as Painted;
    const expected = [360 - 180 * scale, 640 - 320 * scale, 360 * scale, 640 * scale];

    expect(grown.alpha).toBeCloseTo(0.5);
    grown.at.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!));
    const [clipBox, clipRadius] = grown.clip!.replace('round ', '').split(' r');
    clipBox!.split(',').map(Number).forEach((value, index) => expect(value).toBeCloseTo(expected[index]!));
    expect(Number(clipRadius)).toBeCloseTo(36 * scale);
  });

  it('moves a layer by fractions of the frame, its clip travelling with it', () => {
    const painted = compose([entry('inset', { assetRect: inset, transform: { ...IDENTITY, e: -0.75 } }, 360, 640)]);

    expect(painted[1]).toEqual({ what: 'inset', at: [-360, 320, 360, 640], clip: 'rect -360,320,360,640' });
  });

  it('turns a layer about the centre of its rect', () => {
    const radians = Math.PI / 4;
    const turned = { a: Math.cos(radians), b: Math.sin(radians), c: -Math.sin(radians), d: Math.cos(radians), e: 0, f: 0 };
    const painted = compose([entry('inset', { assetRect: inset, transform: turned }, 360, 640)]) as Painted[];

    expect(painted[1]!.rotationDeg).toBeCloseTo(45);
    painted[1]!.centre!.forEach((value, index) => expect(value).toBeCloseTo([360, 640][index]!));
  });

  it('hides the inset part of a layer\'s rect on top of its own clip, the inset moving with it', () => {
    const painted = compose([entry('inset', {
      assetRect: inset,
      cornerRadius: 0.05,
      transform: { ...IDENTITY, f: 0.125 },
      clipInset: { top: 0, right: 0.5, bottom: 0, left: 0 },
    }, 360, 640)]);

    expect(painted[1]).toEqual({
      what: 'inset',
      at: [180, 480, 360, 640],
      clip: 'round 180,480,360,640 r36 & rect 180,480,180,640',
    });
  });

  it('draws nothing of a layer whose inset hides all of it', () => {
    const shut = { top: 0, right: 0.5, bottom: 0, left: 0.5 };

    expect(compose([entry('inset', { assetRect: inset, clipInset: shut }, 360, 640)])).toHaveLength(1);
  });

  it('blurs a layer by a fraction of the frame\'s shorter side, and leaves the context unfiltered after it', () => {
    const painted = compose([
      entry('inset', { assetRect: inset, blur: 0.025 }, 360, 640),
      entry('logo', { assetRect: { x: 0, y: 0, width: 0.25, height: 0.25 }, kind: 'image' }, 180, 320),
    ]) as Painted[];

    expect(painted[1]!.filter).toBe('blur(18px)');
    expect(painted[2]!.filter).toBeUndefined();
  });

  it('draws nothing of a layer that is fully transparent', () => {
    const painted = compose([entry('inset', { assetRect: inset, opacity: 0 }, 360, 640)]);

    expect(painted).toEqual([{ what: 'video', at: [0, 0, 720, 1280], clip: null }]);
  });
});

describe('a composed frame with layers showing the source\'s own picture', () => {
  const left = { share: 0, offset: 0 };
  const centred = { share: 0.5, offset: 0 };

  it('draws the source\'s picture in the layer\'s state alone, with nothing beneath it, where it covers at rest', () => {
    const painted = compose([entry('video', { kind: 'source-picture', position: { x: left, y: centred } }, 1920, 1080)]);
    const scale = HEIGHT / 1080;

    expect(painted).toEqual([{ what: 'video', at: [0, 0, 1920 * scale, HEIGHT], clip: null }]);
  });

  it('draws it over black, and never whole beneath, where it leaves the frame showing', () => {
    const scaled = { ...IDENTITY, a: 0.5, d: 0.5 };
    const painted = compose([entry('video', { kind: 'source-picture', transform: scaled }, WIDTH, HEIGHT)]);

    expect(painted).toEqual([
      'fill #000000 0,0,720,1280',
      { what: 'video', at: [180, 320, 360, 640], clip: 'rect 180,320,360,640' },
    ]);
  });

  it('draws it into a layer\'s video rect instead of its own rect, keeping its own state', () => {
    const topHalf = { x: 0, y: 0, width: 1, height: 0.5 };
    const bottomHalf = { x: 0, y: 0.5, width: 1, height: 0.5 };
    const painted = compose([
      entry('video', { kind: 'source-picture', opacity: 0.5 }, WIDTH, HEIGHT),
      entry('footage', { assetRect: topHalf, videoRect: bottomHalf }, 720, 640),
    ]);

    expect(painted[0]).toBe('fill #000000 0,0,720,1280');
    expect(painted[1]).toMatchObject({ what: 'video', clip: 'rect 0,640,720,640', alpha: 0.5 });
    expect(painted[2]).toMatchObject({ what: 'footage' });
  });

  it('is hidden like any other layer beneath a full-frame cover video', () => {
    const painted = compose([entry('video', { kind: 'source-picture' }, WIDTH, HEIGHT), entry('footage', {}, WIDTH, HEIGHT)]);

    expect(painted).toEqual([{ what: 'footage', at: [0, 0, 720, 1280], clip: null }]);
  });
});

describe('a composed frame of another shape than the video', () => {
  it('covers the frame with the video, centred, where no layer shows it', () => {
    const scale = HEIGHT / 1080;

    expect(compose([], 1920, 1080)).toEqual([
      { what: 'video', at: [(WIDTH - 1920 * scale) / 2, 0, 1920 * scale, HEIGHT], clip: null },
    ]);
  });
});

/**
 * Stands in for the canvas a backdrop layer copies the frame into: it
 * remembers, as its name, the log of what the frame held when copied.
 */
class CopyingCanvas {
  what = 'empty copy';
  constructor(readonly width: number, readonly height: number) {}
  getContext(): { drawImage: (source: RecordingContext['canvas']) => void } {
    return { drawImage: (source) => { this.what = `copy of ${source.what}`; } };
  }
}

describe('a composed frame with a backdrop layer', () => {
  beforeEach(() => { vi.stubGlobal('OffscreenCanvas', CopyingCanvas); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('draws the frame beneath it again, in its state, over black, and the layers above it after', () => {
    const painted = compose([
      entry('inset', { assetRect: { x: 0.5, y: 0.5, width: 0.5, height: 0.25 } }, 400, 400),
      entry('backdrop', { kind: 'backdrop', opacity: 0.5, brightness: 3 }, WIDTH, HEIGHT),
      entry('logo', { assetRect: { x: 0, y: 0, width: 0.25, height: 0.25 }, kind: 'image' }, 100, 100),
    ]);

    expect(painted.slice(2)).toEqual([
      'fill #000000 0,0,720,1280',
      { what: 'copy of frame', at: [0, 0, 720, 1280], clip: 'rect 0,0,720,1280', alpha: 0.5, filter: 'brightness(3)' },
      { what: 'logo', at: [-70, 0, 320, 320], clip: 'rect 0,0,180,320' },
    ]);
  });

  it('draws the frame again over its background colour where it has one', () => {
    const painted = compose([entry('backdrop', { kind: 'backdrop', opacity: 0.2, backgroundColor: 'rgb(255, 255, 255)' }, WIDTH, HEIGHT)]);

    expect(painted[1]).toBe('fill rgb(255, 255, 255) 0,0,720,1280');
  });

  it('grades the picture beneath it, which it then draws again, and grades nothing after it', () => {
    const context = new RecordingContext();
    const grader = { grade: (target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
      (target as unknown as RecordingContext).log.push('grade');
    } };
    const grade = { exposure: 0.2, contrast: 0, saturation: 0, temperature: 0, tint: 0, vignette: 0 };
    new CanvasFootageCompositor(grader).compose(context as unknown as CanvasRenderingContext2D, {
      width: WIDTH,
      height: HEIGHT,
      video: picture('video'),
      videoWidth: WIDTH,
      videoHeight: HEIGHT,
      layers: [entry('backdrop', { kind: 'backdrop', opacity: 0.5 }, WIDTH, HEIGHT)],
      grade,
    });

    expect(context.log.map((step) => (typeof step === 'string' ? step.split(' ')[0] : step.what)))
      .toEqual(['video', 'grade', 'fill', 'copy of frame']);
  });

  it('hides nothing beneath it, even at rest over the whole frame', () => {
    const painted = compose([entry('backdrop', { kind: 'backdrop' }, WIDTH, HEIGHT)]);

    expect(painted[0]).toEqual({ what: 'video', at: [0, 0, 720, 1280], clip: null });
  });
});

describe('a composed frame where a layer draws the video over itself', () => {
  const corner = { x: 0.6, y: 0.6, width: 0.3, height: 0.3 };

  it('draws the layer, then the video covering its rect with rounded corners, and nothing of the video beneath', () => {
    const painted = compose([entry('broll', { videoRect: corner, videoAbove: true, videoCornerRadius: 0.05 }, WIDTH, HEIGHT)]);

    expect(painted).toHaveLength(2);
    expect(painted[0]).toMatchObject({ what: 'broll', at: [0, 0, 720, 1280] });
    expect(painted[1]).toMatchObject({ what: 'video', clip: 'round 432,768,216,384 r36' });
  });

  it('starts from black, not the video, beneath a layer that lets the frame show through', () => {
    const painted = compose([entry('broll', { videoRect: corner, videoAbove: true, opacity: 0.5 }, WIDTH, HEIGHT)]);

    expect(painted.map((step) => (typeof step === 'string' ? step.split(' ')[0] : step.what))).toEqual(['fill', 'broll', 'video']);
  });

  it('draws the video under a layer above it, which covers it as any layer does', () => {
    const painted = compose([
      entry('broll', { videoRect: corner, videoAbove: true }, WIDTH, HEIGHT),
      entry('logo', { assetRect: { x: 0, y: 0, width: 0.25, height: 0.25 }, kind: 'image' }, 100, 100),
    ]);

    expect(painted.map((step) => (typeof step === 'string' ? step.split(' ')[0] : step.what))).toEqual(['broll', 'video', 'logo']);
  });

  it('draws nothing of the video beneath a layer hiding the whole frame above it', () => {
    const painted = compose([
      entry('broll', { videoRect: corner, videoAbove: true }, WIDTH, HEIGHT),
      entry('cover', {}, WIDTH, HEIGHT),
    ]);

    expect(painted.map((step) => (typeof step === 'string' ? step : step.what))).toEqual(['cover']);
  });
});
