import { CssVariable } from '@modules/document/CssVariable';
import type {
  FootageAxisPosition,
  FootageClipInset,
  FootageLayerFrameState,
  FootagePosition,
  FootageTransform,
} from '@modules/video/FootageLayerFrameState';
import type { FootageRect } from '@modules/video/FootageRect';
import type { FootageLayerStateReader } from '@modules/video/stage/FootageLayerStateReader';
import type { FootageStageProbe } from '@modules/video/stage/FootageStageProbe';

/** A box's size in pixels, which a percentage of it is read against. */
interface BoxSize {
  readonly width: number;
  readonly height: number;
}

/** A computed length as the percentage and the pixels it adds up. */
interface LengthTerms {
  percent: number;
  pixels: number;
}

const NO_INSET: FootageClipInset = { top: 0, right: 0, bottom: 0, left: 0 };
const CENTRED: FootageAxisPosition = { share: 0.5, offset: 0 };
const FAR_EDGES = new Set(['right', 'bottom']);
const BLUR = /blur\(\s*(-?[\d.]+(?:e-?\d+)?)px\s*\)/i;
const BRIGHTNESS = /brightness\(\s*(-?[\d.]+(?:e-?\d+)?)(%?)\s*\)/i;
const INSET = /^inset\((.*)\)$/i;
// The alpha of an `rgba()` or `rgb(… / a)` colour as the browser computes it: a fourth value after three
// commas, or a value after a slash. An opaque colour is computed with three values and has none.
const TRANSPARENT_ALPHA = /^rgba?\((?:(?:[^,)]*,){3}|[^)]*\/)\s*([\d.]+)\s*\)$/i;
/** The four custom properties a rect of the stage is declared through. */
interface StageRectSides {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
}

const VIDEO_SIDES: StageRectSides = {
  left: CssVariable.VIDEO_LEFT, top: CssVariable.VIDEO_TOP, width: CssVariable.VIDEO_WIDTH, height: CssVariable.VIDEO_HEIGHT,
};
const CLIP_SIDES: StageRectSides = {
  left: CssVariable.CLIP_LEFT, top: CssVariable.CLIP_TOP, width: CssVariable.CLIP_WIDTH, height: CssVariable.CLIP_HEIGHT,
};
const LENGTH = /^(-?[\d.]+(?:e-?\d+)?)(px|%)?$/i;
const CALC_TERM = /([+-]?)\s*(-?[\d.]+(?:e-?\d+)?)(px|%)/gi;
// Below this a value is the float noise of a matrix product, not a motion.
const NOISE = 1e-9;
// Less than a pixel of the largest frame there is: a layout's rounding, not a rect anyone placed.
const WHOLE_FRAME_TOLERANCE = 1e-5;


/**
 * Reads how a layer's box is drawn right now off what the browser
 * resolved for it, in the engine's terms: everything a share of the
 * stage, so it holds at whatever size the frame is drawn.
 *
 * What it reads, and nothing else, because nothing else draws:
 * - the layout box relative to the stage, before any transform — the
 *   asset rect;
 * - `transform`, `translate`, `rotate` and `scale`, composed about the
 *   box's `transform-origin` and turned into one transform about its
 *   centre;
 * - `opacity`, the radius of a `blur()` and the amount of a
 *   `brightness()` in `filter`, an `inset()` `clip-path`, the top-left
 *   `border-radius`, `object-fit` (`contain` and `scale-down` contain;
 *   anything else covers) and `object-position`;
 * - `background-color` and `--picture-fill-blur` (a length of the
 *   stage): what fills the box around a picture fitted inside it;
 * - `--clip-left`, `--clip-top`, `--clip-width`, `--clip-height` and
 *   `--clip-radius`, each a length of the stage: a rect the layer is
 *   cut to, its corners rounded;
 * - `--video-left`, `-top`, `-width` and `-height`, each resolved as a
 *   length of the stage, for where the video goes; all four, or the
 *   video stays as it is — as it does where they cover the whole frame,
 *   which is the video re-framed to the frame it already fills.
 *
 * The browser is the parser: every value here is a computed one, which
 * the browser has already resolved to pixels wherever CSS lets it. A
 * value it leaves relative — a percentage in a clip or a radius — is
 * read against the box, the way CSS reads it.
 */
export class ComputedFootageLayerStateReader implements FootageLayerStateReader {
  /**
   * The state `box` is drawn in on a stage of `stageWidth × stageHeight`
   * pixels. `probe` resolves, on that stage, the lengths a custom
   * property of the box holds unevaluated.
   */
  read(box: HTMLElement, probe: FootageStageProbe, stageWidth: number, stageHeight: number): FootageLayerFrameState {
    const style = window.getComputedStyle(box);
    const left = this.pixels(style.left) + this.pixels(style.marginLeft);
    const top = this.pixels(style.top) + this.pixels(style.marginTop);
    const size: BoxSize = { width: this.pixels(style.width), height: this.pixels(style.height) };
    const shorterSide = Math.min(stageWidth, stageHeight);
    const videoAbove = this.probedNumber(style.getPropertyValue(CssVariable.VIDEO_ABOVE), probe) >= 0.5;
    return {
      assetRect: { x: left / stageWidth, y: top / stageHeight, width: size.width / stageWidth, height: size.height / stageHeight },
      fit: style.objectFit === 'contain' || style.objectFit === 'scale-down' ? 'contain' : 'cover',
      position: this.positionOf(style.objectPosition, stageWidth, stageHeight),
      cornerRadius: this.cornerRadiusPx(style.borderTopLeftRadius, size) / shorterSide,
      opacity: this.opacityOf(style.opacity),
      transform: this.transformOf(style, size, stageWidth, stageHeight),
      blur: this.blurPx(style.filter) / shorterSide,
      brightness: this.brightnessOf(style.filter),
      clipInset: this.clipInsetOf(style.clipPath, size),
      videoRect: this.videoRectOf(style, probe, stageWidth, stageHeight, videoAbove),
      videoAbove,
      videoCornerRadius: videoAbove ? this.probedLength(style.getPropertyValue(CssVariable.VIDEO_RADIUS), probe) / shorterSide : 0,
      backgroundColor: this.backgroundColorOf(style.backgroundColor),
      fillBlur: this.probedLength(style.getPropertyValue(CssVariable.PICTURE_FILL_BLUR), probe) / shorterSide,
      clipRect: this.stageRectOf(style, probe, stageWidth, stageHeight, CLIP_SIDES),
      clipRadius: this.probedLength(style.getPropertyValue(CssVariable.CLIP_RADIUS), probe) / shorterSide,
    };
  }

  /**
   * `object-position` as a share of the room and a move: a percentage is
   * the share, a length the move. Written from an edge (`right 10px`),
   * the share is that edge's and the move runs inwards from it.
   */
  private positionOf(value: string, stageWidth: number, stageHeight: number): FootagePosition {
    const parts = this.topLevelParts(value);
    if (parts.length === 4) {
      return {
        x: this.edgePositionOf(parts[0]!, parts[1]!, stageWidth),
        y: this.edgePositionOf(parts[2]!, parts[3]!, stageHeight),
      };
    }
    if (parts.length !== 2) return { x: CENTRED, y: CENTRED };
    return { x: this.axisPositionOf(parts[0]!, stageWidth), y: this.axisPositionOf(parts[1]!, stageHeight) };
  }

  private edgePositionOf(edge: string, length: string, stageLength: number): FootageAxisPosition {
    const fromEdge = this.axisPositionOf(length, stageLength);
    if (!FAR_EDGES.has(edge)) return fromEdge;
    return { share: 1 - fromEdge.share, offset: -fromEdge.offset };
  }

  /** A computed length or percentage, or a `calc()` adding the two: the percentage is the share, the length the move. */
  private axisPositionOf(value: string, stageLength: number): FootageAxisPosition {
    const terms = this.lengthTerms(value);
    return { share: terms.percent / 100, offset: terms.pixels / stageLength };
  }

  /** A computed colour, or null where it paints nothing: `transparent`, or any colour of no alpha. */
  private backgroundColorOf(value: string): string | null {
    const color = value.trim();
    if (color === '' || color === 'transparent') return null;
    const alpha = TRANSPARENT_ALPHA.exec(color);
    return alpha !== null && parseFloat(alpha[1]!) === 0 ? null : color;
  }

  private opacityOf(value: string): number {
    const opacity = parseFloat(value);
    return Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;
  }

  /**
   * Every transform the box carries, as one matrix about its centre: the
   * browser applies `translate`, `rotate`, `scale` and then `transform`,
   * all about `transform-origin`. Moving the origin to the centre adds
   * `(I - M)(origin - centre)` to the move.
   */
  private transformOf(style: CSSStyleDeclaration, size: BoxSize, stageWidth: number, stageHeight: number): FootageTransform {
    const matrix = new DOMMatrix()
      .multiply(this.translateOf(style.translate, size))
      .multiply(this.rotateOf(style.rotate))
      .multiply(this.scaleOf(style.scale))
      .multiply(new DOMMatrix(style.transform === '' ? 'none' : style.transform));
    const [originX = size.width / 2, originY = size.height / 2] = style.transformOrigin
      .split(/\s+/)
      .map((part) => this.pixels(part));
    const offsetX = originX - size.width / 2;
    const offsetY = originY - size.height / 2;
    const moveX = matrix.e + offsetX - (matrix.a * offsetX + matrix.c * offsetY);
    const moveY = matrix.f + offsetY - (matrix.b * offsetX + matrix.d * offsetY);
    return {
      a: this.clean(matrix.a),
      b: this.clean(matrix.b),
      c: this.clean(matrix.c),
      d: this.clean(matrix.d),
      e: this.clean(moveX) / stageWidth,
      f: this.clean(moveY) / stageHeight,
    };
  }

  private translateOf(value: string, size: BoxSize): DOMMatrix {
    if (value === '' || value === 'none') return new DOMMatrix();
    const [x = '0px', y = '0px'] = this.topLevelParts(value);
    return new DOMMatrix().translate(this.length(x, size.width), this.length(y, size.height));
  }

  /** Only a turn in the plane draws on a canvas: one about any other axis is left out. */
  private rotateOf(value: string): DOMMatrix {
    if (value === '' || value === 'none') return new DOMMatrix();
    const parts = value.trim().split(/\s+/);
    const angle = parts[parts.length - 1]!;
    const axis = parts.slice(0, -1).join(' ');
    if (axis !== '' && axis !== 'z' && axis !== '0 0 1') return new DOMMatrix();
    return new DOMMatrix(`rotate(${angle})`);
  }

  private scaleOf(value: string): DOMMatrix {
    if (value === '' || value === 'none') return new DOMMatrix();
    const [x = 1, y = x] = value.trim().split(/\s+/).map((part) => parseFloat(part));
    return new DOMMatrix().scale(Number.isFinite(x) ? x : 1, Number.isFinite(y) ? y : 1);
  }

  private blurPx(filter: string): number {
    const match = BLUR.exec(filter);
    return match === null ? 0 : Math.max(0, parseFloat(match[1]!));
  }

  /** The amount of a `brightness()` in `filter`, a percentage read as its fraction; 1 where there is none. */
  private brightnessOf(filter: string): number {
    const match = BRIGHTNESS.exec(filter);
    if (match === null) return 1;
    const amount = parseFloat(match[1]!) / (match[2] === '%' ? 100 : 1);
    return Number.isFinite(amount) ? Math.max(0, amount) : 1;
  }

  /** An `inset()` clip as fractions of the box; any other shape clips nothing here. */
  private clipInsetOf(clipPath: string, size: BoxSize): FootageClipInset {
    const body = INSET.exec(clipPath.trim())?.[1];
    if (body === undefined) return NO_INSET;
    const offsets = this.topLevelParts(body.split(/\s+round\s+/i)[0]!);
    const [top = '0px', right = top, bottom = top, left = right] = offsets;
    return {
      top: Math.max(0, this.length(top, size.height) / size.height || 0),
      right: Math.max(0, this.length(right, size.width) / size.width || 0),
      bottom: Math.max(0, this.length(bottom, size.height) / size.height || 0),
      left: Math.max(0, this.length(left, size.width) / size.width || 0),
    };
  }

  /** The top-left corner's radius in pixels; a percentage is of the box, and an elliptical one takes its smaller axis. */
  private cornerRadiusPx(value: string, size: BoxSize): number {
    const [horizontal = '0px', vertical = horizontal] = value.trim().split(/\s+/);
    return Math.max(0, Math.min(this.length(horizontal, size.width), this.length(vertical, size.height)));
  }

  /**
   * A number the stage resolves: a custom property holds what it was
   * given, a `calc()` of others included, unevaluated, so the stage
   * evaluates it as a length of that many pixels. 0 where none is given.
   */
  private probedNumber(value: string, probe: FootageStageProbe): number {
    if (value.trim() === '') return 0;
    return probe.width(`calc((${value.trim()}) * 1px)`);
  }

  /** A length the stage resolves, in pixels; 0 where none is given. */
  private probedLength(value: string, probe: FootageStageProbe): number {
    if (value.trim() === '') return 0;
    return Math.max(0, probe.width(value.trim()));
  }

  /**
   * Where the video is re-framed, or null where it keeps its place: no
   * rect, or one covering the whole frame — unless the video is drawn
   * over the layer, where even a whole-frame rect is where it is drawn.
   */
  private videoRectOf(
    style: CSSStyleDeclaration,
    probe: FootageStageProbe,
    stageWidth: number,
    stageHeight: number,
    videoAbove: boolean,
  ): FootageRect | null {
    const rect = this.stageRectOf(style, probe, stageWidth, stageHeight, VIDEO_SIDES);
    return rect === null || (!videoAbove && this.coversWholeFrame(rect)) ? null : rect;
  }

  /** The rect the four custom properties `sides` name on `style`, in fractions of the stage; null unless all four are set. */
  private stageRectOf(
    style: CSSStyleDeclaration,
    probe: FootageStageProbe,
    stageWidth: number,
    stageHeight: number,
    sides: StageRectSides,
  ): FootageRect | null {
    const left = style.getPropertyValue(sides.left).trim();
    const top = style.getPropertyValue(sides.top).trim();
    const width = style.getPropertyValue(sides.width).trim();
    const height = style.getPropertyValue(sides.height).trim();
    if (left === '' || top === '' || width === '' || height === '') return null;
    const resolved = probe.rect(left, top, width, height);
    return {
      x: resolved.left / stageWidth,
      y: resolved.top / stageHeight,
      width: resolved.width / stageWidth,
      height: resolved.height / stageHeight,
    };
  }

  private coversWholeFrame(rect: FootageRect): boolean {
    return Math.abs(rect.x) < WHOLE_FRAME_TOLERANCE
      && Math.abs(rect.y) < WHOLE_FRAME_TOLERANCE
      && Math.abs(rect.width - 1) < WHOLE_FRAME_TOLERANCE
      && Math.abs(rect.height - 1) < WHOLE_FRAME_TOLERANCE;
  }

  /** A computed length: pixels, a percentage of `whole`, or a `calc()` adding the two, which is all a computed length can be. */
  private length(value: string, whole: number): number {
    const terms = this.lengthTerms(value);
    return (terms.percent / 100) * whole + terms.pixels;
  }

  /** The percentage and the pixels a computed length adds up, each summed apart. */
  private lengthTerms(value: string): LengthTerms {
    const trimmed = value.trim();
    const plain = LENGTH.exec(trimmed);
    if (plain !== null) {
      const amount = parseFloat(plain[1]!);
      return plain[2] === '%' ? { percent: amount, pixels: 0 } : { percent: 0, pixels: amount };
    }
    const terms = { percent: 0, pixels: 0 };
    if (!trimmed.startsWith('calc(')) return terms;
    for (const term of trimmed.matchAll(CALC_TERM)) {
      const amount = parseFloat(term[2]!) * (term[1] === '-' ? -1 : 1);
      if (term[3] === '%') terms.percent += amount;
      else terms.pixels += amount;
    }
    return terms;
  }

  private pixels(value: string | undefined): number {
    const amount = parseFloat(value ?? '');
    return Number.isFinite(amount) ? amount : 0;
  }

  /** The space-separated parts of a value, a `calc(…)` counting as one. */
  private topLevelParts(value: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const character of value.trim()) {
      if (character === '(') depth++;
      if (character === ')') depth--;
      if (/\s/.test(character) && depth === 0) {
        if (current !== '') parts.push(current);
        current = '';
        continue;
      }
      current += character;
    }
    if (current !== '') parts.push(current);
    return parts;
  }

  private clean(value: number): number {
    if (Math.abs(value) < NOISE) return 0;
    if (Math.abs(value - 1) < NOISE) return 1;
    return value;
  }
}
