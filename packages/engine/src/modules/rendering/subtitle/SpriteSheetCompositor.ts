import type { SubtitleFrame } from '@modules/rendering/SubtitleFrameRenderer';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { BaselineCssComposer } from '@modules/rendering/styles/BaselineCssComposer';
import type { SegmentWrapperRenderer } from '@modules/rendering/subtitle/SegmentWrapperRenderer';
import type { AssetGroup, UniqueTile, TileAssignment } from '@modules/rendering/subtitle/BatchPlan';

interface TileRender {
  html: string;
  defs: string;
}

/**
 * Composes a sprite sheet per asset group: stacks unique tiles along
 * the smaller dimension axis, emits the SVG holding one
 * `foreignObject` per tile, decodes it through an `<img>` so the
 * bitmap paints into any 2D context without tainting the canvas,
 * and produces draw callbacks that slice the sheet by tile index.
 */
export class SpriteSheetCompositor {

  constructor(
    private readonly styles: Readonly<Record<string, PreparedStyle>>,
    private readonly wrapperRenderer: SegmentWrapperRenderer,
    private readonly baselineCssComposer: BaselineCssComposer,
    private readonly width: number,
    private readonly height: number,
  ) {}

  async renderGroups(groups: ReadonlyMap<string, AssetGroup>): Promise<Map<string, HTMLImageElement>> {
    const sprites = new Map<string, HTMLImageElement>();
    for (const group of groups.values()) {
      const img = await this.renderSpriteSheet(group.uniqueTiles);
      sprites.set(group.assetKey, img);
    }
    return sprites;
  }

  buildFrames(
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

  private async renderSpriteSheet(tiles: ReadonlyArray<UniqueTile>): Promise<HTMLImageElement> {
    const isPortrait = this.width < this.height;
    const sheetW = isPortrait ? tiles.length * this.width : this.width;
    const sheetH = isPortrait ? this.height : tiles.length * this.height;

    let itemUid = 0;
    const tileResults = await Promise.all(
      tiles.map((tile, i) => this.buildTileHtml(tile, i, isPortrait, () => itemUid++)),
    );
    const tilesHtml = tileResults.map((r) => r.html).join('');
    const filterDefs = tileResults.map((r) => r.defs).filter(Boolean).join('');

    const activeKinds = this.collectActiveKinds(tiles);
    const sectionCss = this.joinByKind(activeKinds, (style) => style.scopedCss);
    const baselineCss = this.composeBaselineCssForKinds(activeKinds);
    const defsBlock = filterDefs ? `<defs>${filterDefs}</defs>` : '';
    const styleBlock = this.composeStyleBlock(baselineCss + sectionCss);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">${defsBlock}${styleBlock}${tilesHtml}</svg>`;
    return this.decodeSvg(svg, tiles, sheetW, sheetH);
  }

  /**
   * Wraps the stylesheet in a `<![CDATA[...]]>` section so the XML
   * parser that decodes the data-URL SVG ignores any `<` / `>` inside
   * CSS string values (e.g. `@property syntax: '<integer>'`) instead
   * of treating them as malformed tags. `]]>` inside the CSS would
   * close the CDATA early — splitting around it terminates and
   * re-opens the section cleanly. */
  private composeStyleBlock(css: string): string {
    const safe = css.split(']]>').join(']]]]><![CDATA[>');
    return `<style><![CDATA[${safe}]]></style>`;
  }

  private async buildTileHtml(
    tile: UniqueTile,
    i: number,
    isPortrait: boolean,
    nextUid: () => number,
  ): Promise<TileRender> {
    const tx = isPortrait ? i * this.width : 0;
    const ty = isPortrait ? 0 : i * this.height;
    const wrapperResults = await Promise.all(
      tile.items.map(({ style, seg, t }) => this.wrapperRenderer.buildWrapperHtml(style, seg, t, nextUid)),
    );
    const wrappers = wrapperResults.map((r) => r.html).join('');
    const defs = wrapperResults.map((r) => r.defs).filter(Boolean).join('');
    const html = `<foreignObject x="${tx}" y="${ty}" width="${this.width}" height="${this.height}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${this.width}px;height:${this.height}px;overflow:hidden;container-type:size;">${wrappers}</div></foreignObject>`;
    return { html, defs };
  }

  private composeBaselineCssForKinds(kinds: ReadonlySet<string>): string {
    const perStyle = [...kinds].map((kind) => this.styles[kind]!.baselineNeeds);
    return this.baselineCssComposer.composeUnion(perStyle);
  }

  private collectActiveKinds(tiles: ReadonlyArray<UniqueTile>): Set<string> {
    const kinds = new Set<string>();
    for (const tile of tiles) for (const item of tile.items) kinds.add(item.style.kind);
    return kinds;
  }

  private joinByKind(kinds: ReadonlySet<string>, pick: (style: PreparedStyle) => string): string {
    return [...kinds].map((kind) => pick(this.styles[kind]!)).filter(Boolean).join('\n');
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
        xmlParseError: this.extractXmlParseError(svg),
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

  /**
   * Re-parses the SVG through `DOMParser` to recover the XML-level
   * error message browsers hide behind the opaque "source image cannot
   * be decoded" image-decode failure. Returns the parser's error
   * description, or `null` when the SVG parses cleanly (in which case
   * the decode failed for a different reason — font loading, security,
   * raster size cap, etc.).
   */
  private extractXmlParseError(svg: string): string | null {
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const parseError = parsed.querySelector('parsererror');
    return parseError ? parseError.textContent ?? 'unknown XML parse error' : null;
  }
}
