import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import type { AlignmentConfig } from '@modules/rendering/AlignmentConfig';
import type { DecorationPlacementSide } from '@modules/rendering/DecorationPlacementSide';
import type { RenderingConfig } from '@modules/rendering/RenderingConfig';
import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import type { VideoFrameSource, VideoFrameRegion } from '@modules/rendering/VideoFrameSource';
import { CssScoper } from '@modules/css/CssScoper';
import { CssMinifier } from '@modules/css/CssMinifier';
import { CssVariable } from '@modules/document/CssVariable';
import type { InlineStyleMap } from '@modules/rendering/InlineStyleMap';
import { ElementRenderOverrides } from '@modules/rendering/ElementRenderOverrides';
import { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';
import { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import { SvgFilterLengthResolver } from '@modules/svg-filter/SvgFilterLengthResolver';
import { SegmentPaintRegionResolver } from '@modules/rendering/SegmentPaintRegionResolver';
import type { SegmentAnchorPlacement } from '@modules/rendering/SegmentPaintRegionResolver';
import { SegmentSubtreeHtmlBuilder } from '@modules/rendering/SegmentSubtreeHtmlBuilder';
import type { SegmentSubtreeStyleInput } from '@modules/rendering/SegmentSubtreeHtmlBuilder';
import { VIDEO_FRAME_LAYER_BASELINE_CSS } from '@modules/rendering/VideoFrameLayerClass';
import { DECORATION_CONTAINER_BASELINE_CSS } from '@modules/rendering/DecorationContainerBaselineCss';
import { SegmentPaddingCssRuleBuilder } from '@modules/rendering/SegmentPaddingCssRuleBuilder';

const FINGERPRINT_BASE_S = 10000;

const NUMBER_OF_TILES_TO_TEST = [1, 2, 4, 6, 8, 10, 12, 15, 18, 21, 25, 30];

// 10 frames at 1080×1920 ≈ 80 MB of pixel buffer.
// At 4K the same budget admits only ~2 tiles per batch.
const DEFAULT_MAX_BUFFER_PIXELS = 10 * 1080 * 1920;

const NO_EXCLUDED_WORDS: ReadonlySet<string> = new Set();

// Safety bleed applied to the painted region for video-frame styles
// that don't declare a `rendering.padding`. 0.25em ≈ enough to cover
// a typical text-shadow, kept narrow so the crop still pays off.
const UNDECLARED_PADDING_SAFETY_EM = 0.25;

const BASELINE_CSS = `html { font-size: 16px; text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; animation-fill-mode: both; animation-play-state: paused !important; }
.line { white-space: nowrap; }
${DECORATION_CONTAINER_BASELINE_CSS}
${VIDEO_FRAME_LAYER_BASELINE_CSS}`;

interface AbstractAnim {
  cssVar: CssVariable;
  durationS: number;
}

interface WrapperRender {
  html: string;
  defs: string;
}

interface FilterMaterialization {
  defs: string;
  bindings: ReadonlyMap<string, string>;
}

interface PreparedStyle {
  kind: string;
  scopedCss: string;
  filters: SvgFilterBundle;
  inlineStyles: InlineStyleMap;
  alignment: AlignmentConfig;
  rendering: RenderingConfig;
  wordOverrides: ElementRenderOverrides;
  segmentOverrides: ElementRenderOverrides;
  decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>;
  probeContainer: HTMLElement;
  scopeClass: string;
  probeCache: Map<string, AbstractAnim[]>;
}

interface ResolvedAlignment {
  yPx: number;
  xPx: number;
  vAnchorPct: number;
  hAnchorPct: number;
  vGridAlign: 'start' | 'center' | 'end';
  hGridAlign: 'start' | 'center' | 'end';
}

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
  private readonly cssScoper = new CssScoper();
  private readonly cssMinifier = new CssMinifier();
  private readonly svgFilterScoper = new SvgFilterScoper();
  private readonly segmentPaddingCssRuleBuilder = new SegmentPaddingCssRuleBuilder();
  private width: number | undefined;
  private height: number | undefined;

  /**
   * @param cssEmbedder Inlines external resources (fonts, images) 
   *   referenced by each style's CSS so the resulting stylesheet is
   *   self-contained inside the sandboxed render SVG.
   * @param wordSplitter Splits words into letter units when a style's
   *   `RenderingConfig.splitWordsIntoLetters` is set.
   * @param maxBufferPixels Per-batch memory budget in pixels. With
   *   the probed sprite-length cap, drives `getMaxBatchSize`. The
   *   default sizes a batch to ~80 MB of pixel buffer.
   */
  constructor(
    private readonly cssEmbedder: CssResourceEmbedder,
    private readonly wordSplitter: WordSplitter,
    private readonly maxBufferPixels: number = DEFAULT_MAX_BUFFER_PIXELS,
  ) {}

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
      prepared[kind] = await this.prepareStyle(kind, style);
    }
    this.session = new ActiveRenderSession(
      doc,
      prepared,
      this.wordSplitter,
      this.width!,
      this.height!,
      videoFrameSource ?? null,
    );
  }

  async getMaxBatchSize(): Promise<number> {
    try {
      for (const numberOfTiles of NUMBER_OF_TILES_TO_TEST) {
        const isPortrait = this.width! < this.height!;
        const scaledWidth = isPortrait ? this.width! * numberOfTiles : this.width!;
        const scaledHeight = isPortrait ? this.height! : this.height! * numberOfTiles;
        const length = scaledWidth * scaledHeight;
        if (length > this.maxBufferPixels) {
          return numberOfTiles;
        }
        if (!(await this.testTileSize(scaledWidth, scaledHeight))) {
          return numberOfTiles;
        }
      }
      return 1;
    } catch {
      return 1;
    }
  }

  /**
   * Renders a green field with a red 2×2 marker in the bottom-right
   * corner at the target size, decodes it, paints it, and reads back
   * the corner pixel. Some hosts decode oversize SVGs but leave the
   * far edges of the raster blank — the readback catches that.
   */
  private async testTileSize(width: number, height: number): Promise<boolean> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="green"/><rect x="${width - 2}" y="${height - 2}" width="2" height="2" fill="red"/></svg>`;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    try {
      await img.decode();
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(width - 1, height - 1, 1, 1).data;
      return px[0]! > 200 && px[1]! < 80 && px[2]! < 80 && px[3]! > 200;
    } catch {
      return false;
    }
  }

  async getFrames(
    timestamps: ReadonlyArray<number>,
  ): Promise<Array<SubtitleFrame | null>> {
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
    this.width = undefined;
    this.height = undefined;
  }

  private prependSegmentPaddingRule(css: string, rendering: RenderingConfig): string {
    const rule = this.segmentPaddingCssRuleBuilder.build(rendering.padding);
    return rule ? `${rule}\n${css}` : css;
  }

  private async prepareStyle(kind: string, style: SubtitleStyle): Promise<PreparedStyle> {
    const cssWithPadding = this.prependSegmentPaddingRule(style.css, style.rendering);
    const minified = this.cssMinifier.minify(cssWithPadding);
    const embedded = await this.cssEmbedder.embed(minified);
    const scopeClass = `tscaps-render-${kind}-${Math.random().toString(36).slice(2, 8)}`;
    const { css: cssWithIndirectFilters } = this.svgFilterScoper.rewriteCss(embedded);
    const scopedCss = this.cssScoper.scope(cssWithIndirectFilters, `.${scopeClass}`);

    // Probe styles live in `document.head` while the renderer is
    // open; without the scopeClass guard, any `.word`/`.line`/etc on
    // the host page would inherit them.
    const scopedBaseline = this.cssScoper.scope(BASELINE_CSS, `.${scopeClass}`);
    const probeStyleEl = document.createElement('style');
    probeStyleEl.textContent = scopedBaseline + scopedCss;
    document.head.appendChild(probeStyleEl);

    const probeContainer = document.createElement('div');
    probeContainer.className = scopeClass;
    probeContainer.style.cssText = 'position:fixed;left:-99999px;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probeContainer);

    return {
      kind,
      scopedCss,
      filters: style.svgFilters ?? SvgFilterBundle.empty({
        scopeAt: () => SvgFilterScope.empty(),
        lengthFactorsAt: () => ({ pxPerEm: 0, pxPerCqh: 0 }),
      }),
      inlineStyles: style.inlineStyles,
      alignment: style.alignment,
      rendering: style.rendering,
      wordOverrides: style.wordOverrides ?? ElementRenderOverrides.empty(),
      segmentOverrides: style.segmentOverrides ?? ElementRenderOverrides.empty(),
      decorationPlacements: style.decorationPlacements ?? new Map<string, DecorationPlacementSide>(),
      probeContainer,
      scopeClass,
      probeCache: new Map(),
    };
  }
}


interface RenderItem {
  seg: Segment;
  style: PreparedStyle;
  t: number;
}

interface UniqueTile {
  items: RenderItem[];
  tileIndex: number;
}

interface AssetGroup {
  assetKey: string;
  uniqueTiles: UniqueTile[];
}

interface TileAssignment {
  assetKey: string;
  tileIndex: number;
}

interface BatchPlan {
  groups: Map<string, AssetGroup>;
  assignments: Array<TileAssignment | null>;
}

class ActiveRenderSession {
  private readonly svgFilterScoper = new SvgFilterScoper();
  private readonly svgFilterLengthResolver = new SvgFilterLengthResolver();
  private readonly paintRegionResolver = new SegmentPaintRegionResolver();
  private readonly paintRegionsBySegmentId = new Map<string, VideoFrameRegion>();
  private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder;

  constructor(
    private readonly doc: Document,
    private readonly styles: Readonly<Record<string, PreparedStyle>>,
    wordSplitter: WordSplitter,
    private readonly width: number,
    private readonly height: number,
    private readonly videoFrameSource: VideoFrameSource | null,
  ) {
    this.subtreeBuilder = new SegmentSubtreeHtmlBuilder(wordSplitter);
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    if (timestamps.length === 0) return [];
    const plan = this.planBatch(timestamps);
    if (plan.groups.size === 0) return timestamps.map(() => null);
    const sprites = await this.renderGroups(plan.groups);
    return this.buildFrames(plan.assignments, sprites);
  }

  dispose(): void {
    for (const style of Object.values(this.styles)) {
      style.probeContainer.remove();
      style.probeCache.clear();
    }
    this.paintRegionsBySegmentId.clear();
  }

  /**
   * Splits timestamps into per-asset-key groups so each rendered SVG
   * carries only the CSS and font payload its tiles actually need —
   * sharing one data URL across kinds with disjoint assets transfers
   * extra bytes for no amortization gain. Within each group,
   * timestamps sharing a state key collapse into one tile.
   */
  private planBatch(timestamps: ReadonlyArray<number>): BatchPlan {
    const groups = new Map<string, AssetGroup>();
    const tilesByKey = new Map<string, Map<string, UniqueTile>>();

    const assignments = timestamps.map((t): TileAssignment | null => {
      const items = this.itemsAt(t);
      if (items.length === 0) return null;

      const assetKey = this.computeAssetKey(items);
      let group = groups.get(assetKey);
      let groupTiles: Map<string, UniqueTile>;
      if (!group) {
        group = { assetKey, uniqueTiles: [] };
        groups.set(assetKey, group);
        groupTiles = new Map();
        tilesByKey.set(assetKey, groupTiles);
      } else {
        groupTiles = tilesByKey.get(assetKey)!;
      }

      const stateKey = this.computeStateKey(items, t);
      let tile = groupTiles.get(stateKey);
      if (!tile) {
        tile = { items, tileIndex: group.uniqueTiles.length };
        group.uniqueTiles.push(tile);
        groupTiles.set(stateKey, tile);
      }
      return { assetKey, tileIndex: tile.tileIndex };
    });

    return { groups, assignments };
  }

  private async renderGroups(groups: ReadonlyMap<string, AssetGroup>): Promise<Map<string, HTMLImageElement>> {
    const sprites = new Map<string, HTMLImageElement>();
    for (const group of groups.values()) {
      const img = await this.renderSpriteSheet(group.uniqueTiles);
      sprites.set(group.assetKey, img);
    }
    return sprites;
  }

  private buildFrames(
    assignments: ReadonlyArray<TileAssignment | null>,
    sprites: ReadonlyMap<string, HTMLImageElement>,
  ): Array<SubtitleFrame | null> {
    const isPortrait = this.width < this.height;
    return assignments.map((assn) => {
      if (!assn) return null;
      const img = sprites.get(assn.assetKey)!;
      const sx = isPortrait ? assn.tileIndex * this.width : 0;
      const sy = isPortrait ? 0 : assn.tileIndex * this.height;
      return {
        draw: (ctx, dx, dy, dw, dh) =>
          ctx.drawImage(img, sx, sy, this.width, this.height, dx, dy, dw, dh),
      };
    });
  }

  private async renderSpriteSheet(
    tiles: ReadonlyArray<UniqueTile>,
  ): Promise<HTMLImageElement> {
    const isPortrait = this.width < this.height;
    const sheetW = isPortrait ? tiles.length * this.width : this.width;
    const sheetH = isPortrait ? this.height : tiles.length * this.height;

    let itemUid = 0;
    const tileResults = await Promise.all(
      tiles.map((tile, i) => this.buildTileHtml(tile, i, isPortrait, this.width, this.height, () => itemUid++)),
    );
    const tilesHtml = tileResults.map((r) => r.html).join('');
    const filterDefs = tileResults.map((r) => r.defs).filter(Boolean).join('');

    const sectionCss = this.joinByKind(this.collectActiveKinds(tiles), (style) => style.scopedCss);
    const defsBlock = filterDefs ? `<defs>${filterDefs}</defs>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">${defsBlock}<style>${BASELINE_CSS}${sectionCss}</style>${tilesHtml}</svg>`;
    return this.decodeSvg(svg, tiles, sheetW, sheetH);
  }

  private collectActiveKinds(tiles: ReadonlyArray<UniqueTile>): Set<string> {
    const kinds = new Set<string>();
    for (const tile of tiles) for (const item of tile.items) kinds.add(item.style.kind);
    return kinds;
  }

  private joinByKind(kinds: ReadonlySet<string>, pick: (style: PreparedStyle) => string): string {
    return [...kinds].map((kind) => pick(this.styles[kind]!)).filter(Boolean).join('\n');
  }

  private async buildTileHtml(
    tile: UniqueTile,
    i: number,
    isPortrait: boolean,
    width: number,
    height: number,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const tx = isPortrait ? i * width : 0;
    const ty = isPortrait ? 0 : i * height;
    const wrapperResults = await Promise.all(
      tile.items.map(({ style, seg, t }) => this.buildWrapperHtml(style, seg, t, width, height, nextUid)),
    );
    const wrappers = wrapperResults.map((r) => r.html).join('');
    const defs = wrapperResults.map((r) => r.defs).filter(Boolean).join('');
    const html = `<foreignObject x="${tx}" y="${ty}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${height}px;overflow:hidden;container-type:size;">${wrappers}</div></foreignObject>`;
    return { html, defs };
  }

  private async decodeSvg(svg: string, tiles: ReadonlyArray<UniqueTile>, sheetW: number, sheetH: number): Promise<HTMLImageElement> {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    // `onload` can fire before custom fonts have finished applying,
    // producing visually-laggy captures with foreignObject + @font-face.
    // `decode()` only resolves once the image is fully paint-ready.
    try {
      await img.decode();
    } catch (e) {
      const kinds = new Set<string>();
      for (const tile of tiles) for (const item of tile.items) kinds.add(item.style.kind);
      console.error('[tscaps] subtitle SVG decode failed', {
        error: e instanceof Error ? e.message : String(e),
        kinds: [...kinds],
        tiles: tiles.length,
        sheetW,
        sheetH,
        svgLength: svg.length,
        svgHead: svg.slice(0, 400),
      });
      throw new Error(`Subtitle render failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    return img;
  }

  private itemsAt(t: number): RenderItem[] {
    const items: RenderItem[] = [];
    for (const seg of this.doc.getActiveSegments(t)) {
      const style = this.styles[seg.getSection().kind];
      if (style) items.push({ seg, style, t });
    }
    return items;
  }

  private computeAssetKey(items: ReadonlyArray<RenderItem>): string {
    const kinds = new Set<string>();
    for (const it of items) kinds.add(it.style.kind);
    return [...kinds].sort().join(',');
  }

  private computeStateKey(items: ReadonlyArray<RenderItem>, t: number): string {
    return items.map(({ seg, style }) => {
      const base = `${style.kind}:${seg.id}:${this.fingerprintSegmentState(seg, t)}`;
      return this.isItemAnimating(style, seg, t) ? `${base}:${t.toFixed(3)}` : base;
    }).join('|');
  }

  /**
   * Captures every time-varying CSS class the segment subtree exposes
   * (segment, lines, words) so two timestamps that resolve to the same
   * computed style — and therefore the same rendered frame outside
   * active animation windows — share a tile, while two timestamps with
   * different class states (e.g. a line pre-narration vs. already
   * narrated) stay distinct even when no word is active.
   */
  private fingerprintSegmentState(seg: Segment, t: number): string {
    const segClasses = seg.getCssClasses(t).join(',');
    const lineFingerprints = [...seg.lines].map((line) => this.fingerprintLineState(line, t));
    return `${segClasses}|{${lineFingerprints.join(';')}}`;
  }

  private fingerprintLineState(line: Line, t: number): string {
    const lineClasses = line.getCssClasses(t).join(',');
    const wordClasses = [...line.words].map((w) => w.getCssClasses(t).join(',')).join('|');
    return `${lineClasses}[${wordClasses}]`;
  }

  private isItemAnimating(style: PreparedStyle, seg: Segment, t: number): boolean {
    // Letter-level CSS typically combines time vars via calc(), which
    // destroys the fingerprint-based probe; treat the segment as
    // always animating in that mode and redraw every frame.
    if (style.rendering.splitWordsIntoLetters) return true;
    // Styles that bake the underlying video frame into their visuals
    // change every tick by definition — no two timestamps share state.
    if (style.rendering.videoFrame.required) return true;
    // Filter definitions whose materialized output can vary with
    // `currentTime` likewise force per-frame redraw; conservatively
    // treat any non-empty filter set as time-varying — the renderer
    // has no introspection into the consumer's scope provider.
    if (!style.filters.definitions.isEmpty()) return true;

    const segClasses = seg.getCssClasses(t);
    if (this.evalAnims(this.segmentTiming(style, segClasses), t, seg.time.start, seg.time.end)) return true;

    return [...seg.lines].some((line) => {
      const lineClasses = line.getCssClasses(t);
      if (this.evalAnims(this.lineTiming(style, lineClasses, segClasses), t, seg.time.start, seg.time.end, line.time.start, line.time.end)) return true;

      return [...line.words].some((word) => {
        const wordClasses = word.getCssClasses(t);
        return this.evalAnims(this.wordTiming(style, wordClasses, lineClasses, segClasses), t, seg.time.start, seg.time.end, line.time.start, line.time.end, word.time.start, word.time.end);
      });
    });
  }

  private evalAnims(anims: AbstractAnim[], t: number, segStart: number, segEnd: number, lineStart?: number, lineEnd?: number, wordStart?: number, wordEnd?: number): boolean {
    return anims.some((a) => {
      let startT: number;
      switch (a.cssVar) {
        case CssVariable.SECTION_STARTS:
        case CssVariable.SECTION_ENDS:
          // Section-level animations are not yet wired into per-frame
          // timing — treat them as never active.
          return false;
        case CssVariable.SEGMENT_STARTS: startT = segStart; break;
        case CssVariable.SEGMENT_ENDS: startT = segEnd; break;

        case CssVariable.LINE_NOT_NARRATED_YET_STARTS: startT = segStart; break;
        case CssVariable.LINE_NOT_NARRATED_YET_ENDS: startT = lineStart ?? segStart; break;
        case CssVariable.LINE_BEING_NARRATED_STARTS: startT = lineStart ?? segStart; break;
        case CssVariable.LINE_BEING_NARRATED_ENDS: startT = lineEnd ?? segEnd; break;
        case CssVariable.LINE_ALREADY_NARRATED_STARTS: startT = lineEnd ?? segEnd; break;
        case CssVariable.LINE_ALREADY_NARRATED_ENDS: startT = segEnd; break;

        case CssVariable.WORD_NOT_NARRATED_YET_STARTS: startT = segStart; break;
        case CssVariable.WORD_NOT_NARRATED_YET_ENDS: startT = wordStart ?? segStart; break;
        case CssVariable.WORD_BEING_NARRATED_STARTS: startT = wordStart ?? segStart; break;
        case CssVariable.WORD_BEING_NARRATED_ENDS: startT = wordEnd ?? segEnd; break;
        case CssVariable.WORD_ALREADY_NARRATED_STARTS: startT = wordEnd ?? segEnd; break;
        case CssVariable.WORD_ALREADY_NARRATED_ENDS: startT = segEnd; break;

        default: return false;
      }
      return t >= startT && t < startT + a.durationS;
    });
  }

  /**
   * Renders the segment and any words that have been promoted out of
   * flow by a per-word alignment override. The promoted words appear as
   * sibling anchors after the main wrapper; their original slot in the
   * line is omitted so neighbours reflow into the freed space.
   */
  private async buildWrapperHtml(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    width: number,
    height: number,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const segmentOverride = style.segmentOverrides.get(seg.id);
    const segmentAlignment: AlignmentConfig = { ...style.alignment, ...segmentOverride?.alignment };

    const segmentInlineStylesOverride = segmentOverride?.inlineStyles;
    const baseInlineStyles: InlineStyleMap = segmentInlineStylesOverride
      ? { ...style.inlineStyles, ...segmentInlineStylesOverride }
      : style.inlineStyles;

    const positionedWords = this.collectPositionedWords(seg, style.wordOverrides);
    const excludedWordIds = new Set(positionedWords.map((w) => w.id));
    const positionedDecorationWords = this.collectPositionedDecorationWords(seg, style);

    // Skip the main segment subtree entirely when every word has been
    // pulled into a positioned-word sibling — otherwise the segment's
    // own decorations (background, ::before chrome, padding) would
    // paint as an empty shell on the frame. Positioned words render
    // below regardless.
    let html = '';
    let defs = '';
    if (!this.allWordsExcluded(seg, excludedWordIds)) {
      const main = await this.buildSegmentSubtreeHtml(
        style, seg, t, width, height, segmentAlignment, baseInlineStyles, excludedWordIds, nextUid,
      );
      html = main.html;
      defs = main.defs;
    }
    for (const word of positionedWords) {
      const wordAlignmentOverride = style.wordOverrides.get(word.id)?.alignment;
      const wordAlignment: AlignmentConfig = { ...segmentAlignment, ...wordAlignmentOverride };
      const line = this.findLineContainingWord(seg, word);
      const built = await this.buildPositionedWordSubtreeHtml(
        style, seg, line, word, t, width, height, wordAlignment, baseInlineStyles, nextUid,
      );
      html += built.html;
      defs += built.defs;
    }
    for (const word of positionedDecorationWords) {
      const decorationId = word.decoration!.id;
      const decorationAlignmentOverride = style.wordOverrides.get(decorationId)?.alignment;
      const decorationAlignment: AlignmentConfig = { ...segmentAlignment, ...decorationAlignmentOverride };
      const line = this.findLineContainingWord(seg, word);
      const built = await this.buildPositionedDecorationSubtreeHtml(
        style, seg, line, word, t, width, height, decorationAlignment, baseInlineStyles, nextUid,
      );
      html += built.html;
      defs += built.defs;
    }
    return { html, defs };
  }

  /**
   * Builds the main anchor → wrapper → segment subtree at the
   * segment's effective alignment. Words whose ids appear in
   * `excludedWordIds` are omitted from the line so neighbours reflow;
   * the caller renders them as separate positioned-word subtrees.
   */
  private async buildSegmentSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    width: number,
    height: number,
    alignment: AlignmentConfig,
    baseInlineStyles: InlineStyleMap,
    excludedWordIds: ReadonlySet<string>,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment, width, height);
    const engineVars = await this.buildEngineVars(style, seg, t, width, height, resolved);
    const { defs, bindings } = this.materializeFilters(style, t, engineVars, nextUid);

    const styleInput = this.composeStyleInput(style, this.mergeExtras(engineVars, bindings, baseInlineStyles));
    const subtreeHtml = this.subtreeBuilder.buildSegmentSubtree(styleInput, seg, t, excludedWordIds);
    const anchorStyle = this.composeAnchorStyle(resolved);

    const html = `<div style="${anchorStyle}">${subtreeHtml}</div>`;
    return { html, defs };
  }

  /**
   * Builds a sibling anchor → wrapper → mini-segment subtree for a
   * single word at its effective alignment. The synthetic chain
   * (segment, single-line, single-word) carries the same time-driven
   * classes and CSS variables as the main render so template rules
   * apply identically; only the position differs.
   */
  private async buildPositionedWordSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    line: Line,
    word: Word,
    t: number,
    width: number,
    height: number,
    alignment: AlignmentConfig,
    baseInlineStyles: InlineStyleMap,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment, width, height);
    const engineVars = await this.buildEngineVars(style, seg, t, width, height, resolved);
    const { defs, bindings } = this.materializeFilters(style, t, engineVars, nextUid);

    const styleInput = this.composeStyleInput(style, this.mergeExtras(engineVars, bindings, baseInlineStyles));
    const subtreeHtml = this.subtreeBuilder.buildSingleWordSubtree(styleInput, seg, line, word, t);
    const anchorStyle = this.composeAnchorStyle(resolved);

    const html = `<div style="${anchorStyle}">${subtreeHtml}</div>`;
    return { html, defs };
  }

  private collectPositionedWords(seg: Segment, wordOverrides: ElementRenderOverrides): Word[] {
    const out: Word[] = [];
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (wordOverrides.get(word.id)?.alignment) out.push(word);
      }
    }
    return out;
  }

  /** Words whose decoration glyph has an alignment override — the glyph paints at its own anchor instead of inline next to the word. */
  private collectPositionedDecorationWords(seg: Segment, style: PreparedStyle): Word[] {
    const out: Word[] = [];
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        if (style.wordOverrides.get(word.decoration.id)?.alignment) out.push(word);
      }
    }
    return out;
  }

  /** Builds a sibling anchor + mini-segment subtree painting only the decoration glyph at its own override-driven alignment. */
  private async buildPositionedDecorationSubtreeHtml(
    style: PreparedStyle,
    seg: Segment,
    line: Line,
    word: Word,
    t: number,
    width: number,
    height: number,
    alignment: AlignmentConfig,
    baseInlineStyles: InlineStyleMap,
    nextUid: () => number,
  ): Promise<WrapperRender> {
    const resolved = this.resolveAlignment(alignment, width, height);
    const engineVars = await this.buildEngineVars(style, seg, t, width, height, resolved);
    const { defs, bindings } = this.materializeFilters(style, t, engineVars, nextUid);

    const styleInput = this.composeStyleInput(style, this.mergeExtras(engineVars, bindings, baseInlineStyles));
    const subtreeHtml = this.subtreeBuilder.buildSingleDecorationSubtree(styleInput, seg, line, word, t);
    const anchorStyle = this.composeAnchorStyle(resolved);

    const html = `<div style="${anchorStyle}">${subtreeHtml}</div>`;
    return { html, defs };
  }

  private allWordsExcluded(seg: Segment, excludedWordIds: ReadonlySet<string>): boolean {
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (!excludedWordIds.has(word.id)) return false;
      }
    }
    return true;
  }

  private findLineContainingWord(seg: Segment, word: Word): Line {
    for (const line of seg.lines) {
      for (const w of line.words) {
        if (w.id === word.id) return line;
      }
    }
    throw new Error(`Word ${word.id} not found in segment ${seg.id}`);
  }

  // Zero-sized grid anchor places the wrapper via `place-items`
  // so the wrapper stays transform-free and doesn't form a
  // stacking context (which would trap descendant
  // `mix-blend-mode` away from the layer).
  private composeAnchorStyle(resolved: ResolvedAlignment): string {
    return `position: absolute; top: ${resolved.yPx}px; left: ${resolved.xPx}px; width: 0; height: 0; display: grid; grid-template: 0 / 0; align-items: ${resolved.vGridAlign}; justify-items: ${resolved.hGridAlign};`;
  }

  /**
   * Per-call style input handed to the subtree builder, materialized
   * from the prepared style plus the per-frame wrapper extras.
   * Pulling this together once per call keeps the builder stateless
   * and avoids re-deriving the same flags inside it.
   */
  private composeStyleInput(style: PreparedStyle, extraWrapperStyles: InlineStyleMap): SegmentSubtreeStyleInput {
    return {
      scopeClass: style.scopeClass,
      baseInlineStyles: style.inlineStyles,
      wordOverrides: style.wordOverrides,
      splitWordsIntoLetters: style.rendering.splitWordsIntoLetters,
      includeVideoFrameLayer: style.rendering.videoFrame.required,
      extraWrapperStyles,
      decorationPlacements: style.decorationPlacements,
    };
  }

  /**
   * Folds the engine-injected video-frame vars and filter-id bindings
   * onto the base inline styles in cascade order so per-segment
   * overrides win over the style's defaults when both are present.
   */
  private mergeExtras(
    engineVars: InlineStyleMap,
    bindings: ReadonlyMap<string, string>,
    baseInlineStyles: InlineStyleMap,
  ): InlineStyleMap {
    return { ...baseInlineStyles, ...engineVars, ...Object.fromEntries(bindings) };
  }

  /**
   * Reduces an `AlignmentConfig` to the concrete numbers the wrapper
   * HTML and video-frame vars consume: the anchor point in pixels, the
   * anchor-edge fraction in percent, and the matching grid keywords.
   * Called per segment with the segment's effective alignment so that
   * per-segment overrides flow through every downstream consumer.
   */
  private resolveAlignment(alignment: AlignmentConfig, width: number, height: number): ResolvedAlignment {
    return {
      yPx: Math.round(alignment.verticalOffset * height),
      xPx: Math.round(alignment.horizontalOffset * width),
      vAnchorPct: alignment.verticalAlign === 'top' ? 0 : alignment.verticalAlign === 'center' ? 50 : 100,
      hAnchorPct: alignment.horizontalAlign === 'left' ? 0 : alignment.horizontalAlign === 'center' ? 50 : 100,
      vGridAlign: alignment.verticalAlign === 'top' ? 'start' : alignment.verticalAlign === 'center' ? 'center' : 'end',
      hGridAlign: alignment.horizontalAlign === 'left' ? 'start' : alignment.horizontalAlign === 'center' ? 'center' : 'end',
    };
  }

  private async buildEngineVars(
    style: PreparedStyle,
    seg: Segment,
    t: number,
    width: number,
    height: number,
    resolved: ResolvedAlignment,
  ): Promise<InlineStyleMap> {
    if (!style.rendering.videoFrame.required) return {};
    const region = this.resolvePaintRegion(style, seg, resolved, width, height);
    // Offset vars assume the consuming element is a direct child of
    // the wrapper: `%` resolves against the wrapper. The `region.x`/`y`
    // bias positions the layer so the cropped frame's (0,0) lands on
    // viewport `(region.x, region.y)`; when no crop applies the bias
    // is zero and the layer covers the full viewport.
    return {
      [CssVariable.VIDEO_FRAME]: `url("${await this.videoFrameSource!.getFrameAt(t, style.rendering.videoFrame.jpegQuality, region)}")`,
      [CssVariable.SUBTITLE_REGION_WIDTH]: `${region.width}px`,
      [CssVariable.SUBTITLE_REGION_HEIGHT]: `${region.height}px`,
      [CssVariable.SUBTITLE_REGION_X]: `calc(${resolved.hAnchorPct}% - ${resolved.xPx - region.x}px)`,
      [CssVariable.SUBTITLE_REGION_Y]: `calc(${resolved.vAnchorPct}% - ${resolved.yPx - region.y}px)`,
    };
  }

  /**
   * Looks up the painted region for `seg` in the per-session cache;
   * on a miss, derives the region (full viewport when any word has a
   * positioned override, otherwise the tight measured bbox) and
   * caches it. Keyed by `${kind}:${seg.id}` to keep two styles'
   * segments from colliding.
   *
   * The tight-crop optimization assumes every word stays inside the
   * segment's in-flow bounding box. As soon as a word is repositioned
   * outside that bbox, the same crop leaves its video-frame backdrop
   * sampling pixels that aren't in the JPEG payload. Falling back to
   * the full viewport for those segments restores correctness; the
   * optimization recovers automatically the moment the user resets
   * the override.
   */
  private resolvePaintRegion(
    style: PreparedStyle,
    seg: Segment,
    placement: SegmentAnchorPlacement,
    viewportWidth: number,
    viewportHeight: number,
  ): VideoFrameRegion {
    const cacheKey = `${style.kind}:${seg.id}`;
    const cached = this.paintRegionsBySegmentId.get(cacheKey);
    if (cached) return cached;
    const region = this.hasPositionedWord(seg, style.wordOverrides) || this.hasPositionedDecoration(seg, style)
      ? { x: 0, y: 0, width: viewportWidth, height: viewportHeight }
      : this.measureSegmentPaintRegion(style, seg, placement, viewportWidth, viewportHeight);
    this.paintRegionsBySegmentId.set(cacheKey, region);
    return region;
  }

  private measureSegmentPaintRegion(
    style: PreparedStyle,
    seg: Segment,
    placement: SegmentAnchorPlacement,
    viewportWidth: number,
    viewportHeight: number,
  ): VideoFrameRegion {
    const segmentHtml = this.subtreeBuilder.buildSegmentSubtree(
      this.composeStyleInput(style, {}),
      seg,
      seg.time.start,
      NO_EXCLUDED_WORDS,
    );
    return this.paintRegionResolver.resolve({
      segmentHtml,
      probeContainer: style.probeContainer,
      placement,
      viewportWidth,
      viewportHeight,
      safetyBleedEm: style.rendering.padding === null ? UNDECLARED_PADDING_SAFETY_EM : 0,
    });
  }

  private hasPositionedWord(seg: Segment, wordOverrides: ElementRenderOverrides): boolean {
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (wordOverrides.get(word.id)?.alignment) return true;
      }
    }
    return false;
  }

  private hasPositionedDecoration(seg: Segment, style: PreparedStyle): boolean {
    for (const line of seg.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        if (style.wordOverrides.get(word.decoration.id)?.alignment) return true;
      }
    }
    return false;
  }

  private materializeFilters(
    style: PreparedStyle,
    t: number,
    engineVars: InlineStyleMap,
    nextUid: () => number,
  ): FilterMaterialization {
    const definitions = style.filters.definitions;
    if (definitions.isEmpty()) return { defs: '', bindings: new Map() };
    const context = { currentTime: t, renderHeightPx: this.height };
    const consumerScope = style.filters.scopeProvider.scopeAt(context);
    const scope = consumerScope.with(SvgFilterScope.fromEntries(Object.entries(engineVars)));
    const lengthFactors = style.filters.scopeProvider.lengthFactorsAt(context);
    const { idByLocal, bindings } = this.svgFilterScoper.scopeIds(
      definitions.ids,
      `${style.scopeClass}-${nextUid()}`,
    );
    const defs = definitions.filters
      .map((filter) => {
        const body = this.svgFilterLengthResolver.resolve(filter.materialize(scope), lengthFactors);
        return `<filter id="${idByLocal.get(filter.id)}">${body}</filter>`;
      })
      .join('');
    return { defs, bindings };
  }

  private wordTiming(style: PreparedStyle, wordClasses: string[], lineClasses: string[], segClasses: string[]): AbstractAnim[] {
    const key = `w:${wordClasses.join(' ')}|l:${lineClasses.join(' ')}|s:${segClasses.join(' ')}`;
    return this.getOrProbeTiming(style, key, () => {
      const seg = document.createElement('div'); seg.className = segClasses.join(' ');
      const line = document.createElement('div'); line.className = lineClasses.join(' ');
      const word = document.createElement('span'); word.className = wordClasses.join(' ');
      this.injectProbeMagic(word);
      line.appendChild(word); seg.appendChild(line);
      style.probeContainer.appendChild(seg);
      const timing = this.readAnimTimings(word);
      style.probeContainer.removeChild(seg);
      return timing;
    });
  }

  private lineTiming(style: PreparedStyle, lineClasses: string[], segClasses: string[]): AbstractAnim[] {
    const key = `l:${lineClasses.join(' ')}|s:${segClasses.join(' ')}`;
    return this.getOrProbeTiming(style, key, () => {
      const seg = document.createElement('div'); seg.className = segClasses.join(' ');
      const line = document.createElement('div'); line.className = lineClasses.join(' ');
      this.injectProbeMagic(line);
      seg.appendChild(line); style.probeContainer.appendChild(seg);
      const timing = this.readAnimTimings(line);
      style.probeContainer.removeChild(seg);
      return timing;
    });
  }

  private segmentTiming(style: PreparedStyle, segClasses: string[]): AbstractAnim[] {
    const key = `s:${segClasses.join(' ')}`;
    return this.getOrProbeTiming(style, key, () => {
      const seg = document.createElement('div'); seg.className = segClasses.join(' ');
      this.injectProbeMagic(seg);
      style.probeContainer.appendChild(seg);
      const timing = this.readAnimTimings(seg);
      style.probeContainer.removeChild(seg);
      return timing;
    });
  }

  // Each CssVariable gets a fingerprint-shaped duration value so the
  // computed `animation-delay` on a probed element identifies which
  // variable a rule consumed.
  private injectProbeMagic(el: HTMLElement): void {
    Object.values(CssVariable).forEach((cssVar, index) => {
      el.style.setProperty(cssVar, `${(index + 1) * FINGERPRINT_BASE_S}s`);
    });
  }

  private getOrProbeTiming(style: PreparedStyle, key: string, probe: () => AbstractAnim[]): AbstractAnim[] {
    let timing = style.probeCache.get(key);
    if (!timing) {
      timing = probe();
      style.probeCache.set(key, timing);
    }
    return timing;
  }

  private readAnimTimings(el: HTMLElement): AbstractAnim[] {
    const computed = window.getComputedStyle(el);
    const durations = this.parseDurationsS(computed.animationDuration);
    const delays = this.parseDurationsS(computed.animationDelay);
    const iterations = computed.animationIterationCount.split(',').map((s) => s.trim());

    if (durations.every((d) => d === 0)) return [];

    const anims: AbstractAnim[] = [];
    const variables = Object.values(CssVariable);

    for (let i = 0; i < durations.length; i++) {
      const d = durations[i] ?? 0;
      if (d === 0) continue;
      const dl = delays[i] ?? 0;
      const fingerprintIndex = (dl / FINGERPRINT_BASE_S) - 1;
      const cssVar = variables[fingerprintIndex];
      if (!cssVar) continue;
      const isInfinite = (iterations[i] ?? '1') === 'infinite';
      anims.push({ cssVar, durationS: isInfinite ? Infinity : d + 0.05 });
    }
    return anims;
  }

  private parseDurationsS(value: string): number[] {
    if (!value) return [0];
    return value.split(',').map((s) => {
      s = s.trim();
      if (s.endsWith('ms')) return parseFloat(s) / 1000;
      if (s.endsWith('s')) return parseFloat(s);
      return 0;
    });
  }

}
