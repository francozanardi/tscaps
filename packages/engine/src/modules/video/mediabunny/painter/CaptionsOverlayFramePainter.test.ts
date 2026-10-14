import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleFrame, SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';
import { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { CaptionStacking } from '@modules/rendering/types/CaptionStacking';
import { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import type { ScopedRenderOverride } from '@modules/rendering/types/ScopedRenderOverride';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { LayeredFrameCompositor } from '@modules/video/mediabunny/frame/LayeredFrameCompositor';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { SubtitleLayerRequest, SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import { CaptionsOverlayFramePainter } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainter';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import { VideoFrameBackdrop } from '@modules/video/mediabunny/painter/VideoFrameBackdrop';
import { SolidColorFrameBackdrop } from '@modules/video/mediabunny/painter/SolidColorFrameBackdrop';
import { TransparentFrameBackdrop } from '@modules/video/mediabunny/painter/TransparentFrameBackdrop';

/**
 * What a frame is painted from, in which order, and how each caption
 * layer is composited.
 *
 * A caption that samples the video paints those pixels inside its own
 * raster and lands on top of the overlay. Shown the bare frame, it puts
 * the frame back over the overlay wherever it paints, and the overlay
 * is a watermark.
 *
 * Every other caption layer is a raster of its own: those over the top
 * layer after it, and a blended one composited with its blend mode
 * against everything beneath it. A run whose document paints nothing in
 * a layer must not open a source for it at all.
 */

/**
 * Stands in for a 2D context: all a layer can tell from it is the
 * operation it is drawn with, and what a stand-in for the video fills or
 * clears, which it writes to the same log as every other draw.
 */
class RecordingContext {
  globalCompositeOperation = 'source-over';
  fillStyle = '';

  constructor(private readonly log: string[]) {}

  fillRect(): void {
    this.log.push(`fill ${this.fillStyle}`);
  }

  clearRect(): void {
    this.log.push('clear');
  }
}

interface Painted {
  /** What the composited frame drew, in order, each with the operation in effect. */
  readonly drawn: string[];
  /** Records every draw as it happens, for drawing something else afterwards. */
  readonly drawLog: string[];
  readonly captionsWereShown: DecodedVideoFrame[];
  readonly topLayerWasShown: DecodedVideoFrame[];
  /** The operation in effect each time the top layer was drawn. */
  readonly topLayerDrawnWith: string[];
  /** Each opened layer's name, mapped to the style kinds it was opened with. */
  readonly openedWith: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly sourceFrame: DecodedVideoFrame;
}

function nameOf(layer: CaptionLayer): string {
  const side = layer.stacking === CaptionStacking.UNDER_TOP_LAYER ? 'under' : 'over';
  return layer.blendMode === CaptionBlendMode.NORMAL ? `captions ${side}` : `${layer.blendMode} ${side}`;
}

class RecordingLayerSources implements SubtitleLayerSourceFactory {
  readonly openedWith = new Map<string, ReadonlyArray<string>>();

  constructor(private readonly drawn: string[], private readonly shown: DecodedVideoFrame[]) {}

  create(layer: CaptionLayer): SubtitleLayerSource {
    const name = nameOf(layer);
    return {
      open: async (_doc, styles) => { this.openedWith.set(name, Object.keys(styles)); },
      lookAhead: () => 1,
      framesFor: async (requests: ReadonlyArray<SubtitleLayerRequest>) => {
        this.shown.push(...requests.map((request) => request.videoFrame));
        return requests.map((): SubtitleFrame => ({
          draw: (context) => { this.drawn.push(`${name} @ ${context.globalCompositeOperation}`); },
        }));
      },
      close: () => {},
    };
  }
}

/** One section per style, each holding a single segment `s-<kind>` with one word `w-<kind>`. */
function documentFor(styles: Readonly<Record<string, SubtitleStyle>>): Document {
  return new Document({
    sections: Object.keys(styles).map((kind) => new Section({
      id: `section-${kind}`,
      kind,
      segments: [new Segment({
        id: `s-${kind}`,
        lines: [new Line({ id: `l-${kind}`, words: [new Word({ id: `w-${kind}`, text: kind, time: new TimeFragment(0, 1) })] })],
      })],
    })),
  });
}

async function paintOneFrame(
  overlayHtml: string | undefined,
  styles: Readonly<Record<string, SubtitleStyle>> = { plain: styleWith({}) },
  backdrop: FrameBackdrop = new VideoFrameBackdrop(),
): Promise<Painted> {
  const drawn: string[] = [];
  const captionsWereShown: DecodedVideoFrame[] = [];
  const topLayerWasShown: DecodedVideoFrame[] = [];
  const topLayerDrawnWith: string[] = [];
  const sourceFrame: DecodedVideoFrame = {
    timestamp: 0,
    duration: 1 / 30,
    draw: () => { drawn.push('frame'); },
    close: () => {},
  };
  const overlayRenderer: OverlayFrameRenderer = {
    render: async () => ({ draw: () => { drawn.push('overlay'); } }),
  };
  const topLayer: TopLayerSource = {
    open: async () => {},
    frameAt: async (_time, videoFrame) => {
      topLayerWasShown.push(videoFrame);
      return {
        draw: (context) => {
          drawn.push('top layer');
          topLayerDrawnWith.push(context.globalCompositeOperation);
        },
      };
    },
    close: () => {},
  };
  const layerSources = new RecordingLayerSources(drawn, captionsWereShown);
  const painter = new CaptionsOverlayFramePainter(
    layerSources,
    new CaptionLayerDemand(new SegmentSubtreeDecomposer()),
    overlayRenderer,
    new LayeredFrameCompositor(),
    documentFor(styles),
    styles,
    overlayHtml,
    topLayer,
    backdrop,
  );
  await painter.begin(720, 1280, 30);
  const [paint] = await painter.paint([{ frame: sourceFrame, outputTimestamp: 0 }]);
  drawn.length = 0;
  paint!(new RecordingContext(drawn) as never);
  return {
    drawn: [...drawn],
    drawLog: drawn,
    captionsWereShown,
    topLayerWasShown,
    topLayerDrawnWith,
    openedWith: layerSources.openedWith,
    sourceFrame,
  };
}

/** A style whose one segment and one word carry the given overrides; the ids follow {@link documentFor}. */
function styleWith(overrides: { segment?: ScopedRenderOverride; word?: ScopedRenderOverride }, kind = ''): SubtitleStyle {
  return {
    rendering: { videoFrame: { required: false } },
    segmentOverrides: ElementRenderOverrides.fromEntries(overrides.segment ? [[`s-${kind}`, overrides.segment]] : []),
    subtreeOverrides: ElementRenderOverrides.fromEntries(overrides.word ? [[`w-${kind}`, overrides.word]] : []),
  } as unknown as SubtitleStyle;
}

describe('the frame a caption is shown', () => {
  it('carries the overlay on top of the video, as the captions will be composited over both', async () => {
    const { drawLog, captionsWereShown } = await paintOneFrame('<div>watermark</div>');
    drawLog.length = 0;
    captionsWereShown[0]!.draw(null as unknown as CanvasRenderingContext2D, 0, 0, 720, 1280);
    expect(drawLog).toEqual(['frame', 'overlay']);
  });

  it('is the video alone when there is no overlay', async () => {
    const { captionsWereShown, sourceFrame } = await paintOneFrame(undefined);
    expect(captionsWereShown[0]).toBe(sourceFrame);
  });

  it('leaves the top layer the bare video, since it cuts the actor out of the video and not out of the overlay', async () => {
    const { topLayerWasShown, sourceFrame } = await paintOneFrame('<div>watermark</div>');
    expect(topLayerWasShown[0]).toBe(sourceFrame);
  });
});

describe('the caption layers', () => {
  it('are composited under the top layer, then over it, each blended layer after the plain one of its side', async () => {
    const { drawn } = await paintOneFrame('<div>watermark</div>', {
      lifted: styleWith({ segment: { stacking: CaptionStacking.OVER_TOP_LAYER } }, 'lifted'),
      liftedBlend: styleWith({ segment: { stacking: CaptionStacking.OVER_TOP_LAYER }, word: { blendMode: CaptionBlendMode.DIFFERENCE } }, 'liftedBlend'),
      blended: styleWith({ word: { blendMode: CaptionBlendMode.DIFFERENCE } }, 'blended'),
    });
    expect(drawn).toEqual([
      'frame',
      'overlay',
      'captions under @ source-over',
      'difference under @ difference',
      'top layer',
      'captions over @ source-over',
      'difference over @ difference',
    ]);
  });

  it('each come from a source opened only with the styles that paint there', async () => {
    const { openedWith } = await paintOneFrame(undefined, {
      blended: styleWith({ word: { blendMode: CaptionBlendMode.DIFFERENCE } }, 'blended'),
      plain: styleWith({}, 'plain'),
    });
    expect(Object.fromEntries(openedWith)).toEqual({
      'captions under': ['blended', 'plain'],
      'difference under': ['blended'],
    });
  });

  it('cost nothing in a run whose document paints nothing outside the base layer', async () => {
    const { drawn, openedWith } = await paintOneFrame(undefined, { plain: styleWith({}, 'plain') });
    expect([...openedWith.keys()]).toEqual(['captions under']);
    expect(drawn).toEqual(['frame', 'captions under @ source-over', 'top layer']);
  });

  it('leave the context drawing plainly once the frame is composited', () => {
    const context = new RecordingContext([]);
    const compositor = new LayeredFrameCompositor();
    compositor.compose(context as never, {
      frame: { timestamp: 0, duration: 1, draw: () => {}, close: () => {} },
      captions: [{
        layer: CaptionLayer.of(CaptionStacking.UNDER_TOP_LAYER, CaptionBlendMode.DIFFERENCE),
        frame: { draw: () => {} },
      }],
      overlay: null,
      topLayer: null,
      blendCaptions: true,
      width: 1,
      height: 1,
    });
    expect(context.globalCompositeOperation).toBe('source-over');
  });
});

describe('a frame painted on something other than the video', () => {
  it('paints a solid colour where the video would be', async () => {
    const { drawn } = await paintOneFrame(undefined, undefined, new SolidColorFrameBackdrop('#00ff00'));
    expect(drawn).toEqual(['fill #00ff00', 'captions under @ source-over', 'top layer']);
  });

  it('shows a caption sampling the video nothing rather than the colour, so a blend in its style cannot mix the colour in', async () => {
    const { drawLog, captionsWereShown } = await paintOneFrame(undefined, undefined, new SolidColorFrameBackdrop('#00ff00'));
    drawLog.length = 0;
    captionsWereShown[0]!.draw(new RecordingContext(drawLog) as never, 0, 0, 720, 1280);
    expect(drawLog).toEqual(['clear']);
  });

  it('composites a blended layer plainly, having nothing to blend with', async () => {
    const { drawn } = await paintOneFrame(undefined, {
      blended: styleWith({ word: { blendMode: CaptionBlendMode.DIFFERENCE } }, 'blended'),
    }, new SolidColorFrameBackdrop('#00ff00'));
    expect(drawn).toContain('difference under @ source-over');
    expect(drawn).not.toContain('difference under @ difference');
  });

  it('cuts the top layer out of the colour, so what it occludes reads as background', async () => {
    const { drawLog, topLayerWasShown, topLayerDrawnWith } = await paintOneFrame(undefined, undefined, new SolidColorFrameBackdrop('#00ff00'));
    drawLog.length = 0;
    topLayerWasShown[0]!.draw(new RecordingContext(drawLog) as never, 0, 0, 720, 1280);
    expect(drawLog).toEqual(['fill #00ff00']);
    expect(topLayerDrawnWith).toEqual(['source-over']);
  });

  it('clears to transparent where the video would be, and keeps the overlay over it', async () => {
    const { drawn } = await paintOneFrame('<div>watermark</div>', undefined, new TransparentFrameBackdrop());
    expect(drawn).toEqual(['clear', 'overlay', 'captions under @ source-over', 'top layer']);
  });

  it('erases the captions under the top layer instead of painting over them when there is nothing to paint', async () => {
    const { topLayerDrawnWith } = await paintOneFrame(undefined, undefined, new TransparentFrameBackdrop());
    expect(topLayerDrawnWith).toEqual(['destination-out']);
  });

  it('cuts the top layer out of something opaque even then, or the eraser would have no shape', async () => {
    const { drawLog, topLayerWasShown } = await paintOneFrame(undefined, undefined, new TransparentFrameBackdrop());
    drawLog.length = 0;
    topLayerWasShown[0]!.draw(new RecordingContext(drawLog) as never, 0, 0, 720, 1280);
    expect(drawLog).toEqual(['fill #000']);
  });
});
