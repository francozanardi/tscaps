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
import { SpriteSheetSizeProber } from '@modules/rendering/subtitle/SpriteSheetSizeProber';
import { ActiveRenderSessionFactory } from '@modules/rendering/subtitle/ActiveRenderSessionFactory';
import type { ActiveRenderSession } from '@modules/rendering/subtitle/ActiveRenderSession';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

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

  constructor(
    private readonly preparedStyleFactory: PreparedStyleFactory,
    private readonly sizeProber: SpriteSheetSizeProber,
    private readonly sessionFactory: ActiveRenderSessionFactory,
  ) {}

  /**
   * Wires the default collaborator graph: a fresh `CssScoper`,
   * `CssMinifier`, `CssVarReferenceScanner`, `BaselineCssComposer`,
   * `SvgFilterScoper`, and `SegmentPaddingCssRuleBuilder` for the
   * style preparation pipeline, plus the per-batch sprite-size prober
   * and the per-session render-state factory. Pass `maxBufferPixels`
   * to override the default per-batch pixel budget.
   */
  static create(
    cssEmbedder: CssResourceEmbedder,
    wordSplitter: WordSplitter,
    options?: { maxBufferPixels?: number },
  ): BrowserSubtitleFrameRenderer {
    const baselineCssComposer = new BaselineCssComposer();
    const preparedStyleFactory = new PreparedStyleFactory(
      cssEmbedder,
      new CssScoper(),
      new CssMinifier(),
      new CssVarReferenceScanner(),
      baselineCssComposer,
      new SvgFilterScoper(),
      new SegmentPaddingCssRuleBuilder(),
    );
    const sizeProber = options?.maxBufferPixels !== undefined
      ? new SpriteSheetSizeProber(options.maxBufferPixels)
      : new SpriteSheetSizeProber();
    const sessionFactory = new ActiveRenderSessionFactory(wordSplitter, baselineCssComposer);
    return new BrowserSubtitleFrameRenderer(preparedStyleFactory, sizeProber, sessionFactory);
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
    this.height = height;
    const prepared: Record<string, PreparedStyle> = {};
    for (const [kind, style] of Object.entries(styles)) {
      prepared[kind] = await this.preparedStyleFactory.create(kind, style, doc);
    }
    this.preparedStyles = prepared;
    this.session = this.sessionFactory.create(doc, prepared, width, height, videoFrameSource ?? null);
  }

  async getMaxBatchSize(): Promise<number> {
    return this.sizeProber.probe(this.width!, this.height!);
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    if (!this.session) return timestamps.map(() => null);
    return this.session.getFrames(timestamps);
  }

  async getFrame(timestamp: number): Promise<SubtitleFrame | null> {
    if (!this.session) return null;
    const [frame] = await this.session.getFrames([timestamp]);
    return frame ?? null;
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
  }
}
