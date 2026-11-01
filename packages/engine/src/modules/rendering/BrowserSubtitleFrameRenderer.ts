import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { VideoFrameSource } from '@modules/rendering/types/VideoFrameSource';
import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { CssScoper } from '@modules/css/CssScoper';
import { CssMinifier } from '@modules/css/CssMinifier';
import { CssVarReferenceScanner } from '@modules/css/CssVarReferenceScanner';
import { BaselineCssComposer } from '@modules/rendering/styles/BaselineCssComposer';
import { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import { SegmentPaddingCssRuleBuilder } from '@modules/rendering/styles/SegmentPaddingCssRuleBuilder';
import { PreparedStyleFactory } from '@modules/rendering/subtitle/PreparedStyleFactory';
import { SpriteSheetSizeProbe } from '@modules/rendering/subtitle/SpriteSheetSizeProbe';
import { ImageDecodeSpriteSheetRasterProbe } from '@modules/rendering/subtitle/ImageDecodeSpriteSheetRasterProbe';
import { ActiveRenderSessionFactory } from '@modules/rendering/subtitle/ActiveRenderSessionFactory';
import type { AnimationStateFingerprintStrategy } from '@modules/rendering/subtitle/AnimationStateFingerprint';
import { WordFragmenter } from '@modules/bidi/WordFragmenter';
import { BidiJsAnalyzer } from '@modules/bidi/BidiJsAnalyzer';
import { CursiveScriptDetector } from '@modules/bidi/CursiveScriptDetector';
import { BidiJsCharacterClassifier } from '@modules/bidi/BidiJsCharacterClassifier';
import { LineBaseDirectionResolver } from '@modules/bidi/LineBaseDirectionResolver';
import type { ActiveRenderSession } from '@modules/rendering/subtitle/ActiveRenderSession';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import { WebKitDetector } from '@modules/rendering/subtitle/WebKitDetector';
import type { VideoFrameLayerMarkup } from '@modules/rendering/subtitle/VideoFrameLayerMarkup';
import { BackgroundVideoFrameLayerMarkup } from '@modules/rendering/subtitle/BackgroundVideoFrameLayerMarkup';
import { DecodedImageVideoFrameLayerMarkup } from '@modules/rendering/subtitle/DecodedImageVideoFrameLayerMarkup';

/**
 * Browser-native `SubtitleFrameRenderer` that builds each batch as a
 * single SVG holding one `foreignObject` per unique visual state, and
 * decodes it through an `<img>` so the resulting bitmap paints into
 * any 2D context — including OffscreenCanvas — without tainting the
 * canvas.
 *
 * Inside a batch, timestamps that hit the same visual state collapse
 * into a single sprite tile; tiles stack along the smaller dimension
 * axis (portrait → row, landscape → column) so the sprite sheet stays
 * under whatever sprite-length cap the host's 2D-canvas backend
 * actually honors. That cap is probed empirically on first `open`
 * — no public browser API surfaces it directly and reported
 * limits (WebGL `MAX_TEXTURE_SIZE`, `MAX_VIEWPORT_DIMS`) bear no
 * stable relationship to what `img.decode` / `drawImage` accept.
 */
export class BrowserSubtitleFrameRenderer implements SubtitleFrameRenderer {
  private session: ActiveRenderSession | null = null;
  private preparedStyles: Record<string, PreparedStyle> | null = null;
  private width: number | undefined;
  private height: number | undefined;
  private maxTilesPerBatch: number | null = null;

  constructor(
    private readonly preparedStyleFactory: PreparedStyleFactory,
    private readonly sizeProbe: SpriteSheetSizeProbe,
    private readonly sessionFactory: ActiveRenderSessionFactory,
    private readonly videoFrameLayerMarkup: VideoFrameLayerMarkup,
  ) {}

  /**
   * Wires the default collaborator graph: a fresh `CssScoper`,
   * `CssMinifier`, `CssVarReferenceScanner`, `BaselineCssComposer`,
   * `SvgFilterScoper`, and `SegmentPaddingCssRuleBuilder` for the
   * style preparation pipeline, plus the sprite-size probe and the
   * per-session render-state factory.
   *
   * `sizeProbe` shares one probe across renderers working at the same
   * output size, which is worth doing — a walk decodes rasters up to
   * the whole pixel budget. It carries its own budget, so
   * `maxBufferPixels` is ignored alongside it.
   *
   * `animationStateFingerprint` picks which implementation describes
   * where a segment's animations stand. Defaults to `keyframe-scan`.
   *
   * `layer` is the caption layer this renderer paints: only the subtrees
   * that paint in it, and nothing for a timestamp none of them reaches.
   * The raster is plain — how the layer is composited is its
   * compositor's job. Defaults to the base layer, which is where every
   * caption paints unless told otherwise.
   *
   * `videoFrameLayerMarkup` is the markup of a style's video-frame
   * layer. Defaults by engine: WebKit decodes a large CSS background
   * inside an SVG image only once something paints it, so the first draw
   * of a sheet would leave the frame out, and it gets the frame as a
   * synchronously decoded image; every other engine gets the lighter
   * background.
   */
  static create(
    cssEmbedder: CssResourceEmbedder,
    wordSplitter: WordSplitter,
    options?: {
      maxBufferPixels?: number;
      sizeProbe?: SpriteSheetSizeProbe;
      animationStateFingerprint?: AnimationStateFingerprintStrategy;
      layer?: CaptionLayer;
      videoFrameLayerMarkup?: VideoFrameLayerMarkup;
    },
  ): BrowserSubtitleFrameRenderer {
    const baselineCssComposer = new BaselineCssComposer();
    const frameDemand = new SubtitleStyleFrameDemand();
    const preparedStyleFactory = new PreparedStyleFactory(
      cssEmbedder,
      new CssScoper(),
      new CssMinifier(),
      new CssVarReferenceScanner(),
      baselineCssComposer,
      new SvgFilterScoper(),
      new SegmentPaddingCssRuleBuilder(),
      frameDemand,
    );
    const sizeProbe = options?.sizeProbe ?? new SpriteSheetSizeProbe(
      new ImageDecodeSpriteSheetRasterProbe(),
      null,
      options?.maxBufferPixels,
    );
    const sessionFactory = new ActiveRenderSessionFactory(
      wordSplitter,
      new WordFragmenter(
        new BidiJsAnalyzer(),
        new CursiveScriptDetector(),
        new LineBaseDirectionResolver(new BidiJsCharacterClassifier()),
        new BidiJsCharacterClassifier(),
      ),
      baselineCssComposer,
      options?.animationStateFingerprint ?? 'keyframe-scan',
      options?.layer ?? CaptionLayer.BASE,
    );
    return new BrowserSubtitleFrameRenderer(
      preparedStyleFactory,
      sizeProbe,
      sessionFactory,
      options?.videoFrameLayerMarkup ?? BrowserSubtitleFrameRenderer.defaultVideoFrameLayerMarkup(),
    );
  }

  private static defaultVideoFrameLayerMarkup(): VideoFrameLayerMarkup {
    return new WebKitDetector(globalThis.navigator).isWebKit()
      ? new DecodedImageVideoFrameLayerMarkup()
      : new BackgroundVideoFrameLayerMarkup();
  }

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    videoFrameSource?: VideoFrameSource,
  ): Promise<void> {
    const requiresFrame = Object.values(styles).some((s) => s.rendering.videoFrame.required);
    if (requiresFrame && !videoFrameSource) {
      throw new Error(
        'A SubtitleStyle declares videoFrame.required=true but no VideoFrameSource was supplied to open().',
      );
    }
    this.width = width;
    this.maxTilesPerBatch = null;
    this.height = height;
    const prepared: Record<string, PreparedStyle> = {};
    for (const [kind, style] of Object.entries(styles)) {
      prepared[kind] = await this.preparedStyleFactory.create(kind, style, doc);
    }
    this.preparedStyles = prepared;
    this.session = this.sessionFactory.create(
      doc,
      prepared,
      width,
      height,
      videoFrameSource ?? null,
      this.videoFrameLayerMarkup,
    );
  }

  async getMaxTilesPerBatch(): Promise<number> {
    if (this.maxTilesPerBatch === null) {
      this.maxTilesPerBatch = Math.max(1, await this.sizeProbe.probe(this.width!, this.height!));
    }
    return this.maxTilesPerBatch;
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    if (!this.session) return timestamps.map(() => null);
    return this.session.getFrames(timestamps, await this.getMaxTilesPerBatch());
  }

  close(): void {
    this.session?.dispose();
    this.session = null;
    if (this.preparedStyles) {
      for (const style of Object.values(this.preparedStyles)) {
        style.probeStyleElement.remove();
        style.probeContainer.remove();
      }
      this.preparedStyles = null;
    }
    this.width = undefined;
    this.height = undefined;
    this.maxTilesPerBatch = null;
  }
}
