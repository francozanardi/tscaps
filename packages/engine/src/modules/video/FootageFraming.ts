import type { FootageAxisPosition, FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootagePicture } from '@modules/video/FootagePicture';

// How far past its box a blurred fill reaches, so the blur's edges fall outside the box.
const FILL_GROWTH = 1.1;

/** A box on the frame, in pixels from its top-left corner. */
export interface FootageBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where a picture lands on a frame of `frameWidth × frameHeight` pixels
 * when it is drawn in a layer's state: the asset rect's box in pixels,
 * the box the whole picture is scaled into, the part of it that shows,
 * the radius its corners take, and whether it stands exactly as its
 * rect places it.
 *
 * Pure arithmetic, apart from {@link draw}.
 */
export class FootageFraming {
  constructor(
    private readonly state: FootageLayerFrameState,
    private readonly frameWidth: number,
    private readonly frameHeight: number,
  ) {}

  /** The asset rect in pixels. */
  box(): FootageBox {
    const rect = this.state.assetRect;
    return {
      x: rect.x * this.frameWidth,
      y: rect.y * this.frameHeight,
      width: rect.width * this.frameWidth,
      height: rect.height * this.frameHeight,
    };
  }

  /**
   * Where the whole of a `pictureWidth × pictureHeight` picture is drawn:
   * scaled to cover the box or to fit inside it, placed at the state's
   * position. Under `cover` it reaches past the box on one axis.
   */
  pictureBox(pictureWidth: number, pictureHeight: number): FootageBox {
    const box = this.box();
    const scaleToCover = Math.max(box.width / pictureWidth, box.height / pictureHeight);
    const scaleToFit = Math.min(box.width / pictureWidth, box.height / pictureHeight);
    const scale = this.state.fit === 'cover' ? scaleToCover : scaleToFit;
    const width = pictureWidth * scale;
    const height = pictureHeight * scale;
    const { x, y } = this.state.position;
    return {
      x: box.x + (box.width - width) * x.share + x.offset * this.frameWidth,
      y: box.y + (box.height - height) * y.share + y.offset * this.frameHeight,
      width,
      height,
    };
  }

  /**
   * What of the picture shows: the box under `cover`, or under `contain`
   * where the box is filled around the picture ({@link isFilled}); the
   * picture's own box under `contain` otherwise. Its corners are the
   * ones rounded.
   */
  visibleBox(pictureWidth: number, pictureHeight: number): FootageBox {
    return this.state.fit === 'cover' || this.isFilled() ? this.box() : this.pictureBox(pictureWidth, pictureHeight);
  }

  /** Whether a picture fitted inside the box has the box filled around it: by its background colour, its blurred copy, or both. */
  isFilled(): boolean {
    return this.state.fit === 'contain' && (this.state.backgroundColor !== null || this.state.fillBlur > 0);
  }

  /**
   * The corner radius in pixels: a fraction of the frame's shorter side,
   * never more than half the shorter side of the visible box, never
   * negative.
   */
  cornerRadiusPx(pictureWidth: number, pictureHeight: number): number {
    const visible = this.visibleBox(pictureWidth, pictureHeight);
    const requested = this.state.cornerRadius * Math.min(this.frameWidth, this.frameHeight);
    return Math.max(0, Math.min(requested, Math.min(visible.width, visible.height) / 2));
  }

  /**
   * Whether a picture drawn here hides the whole frame: a square-cornered
   * cover of a rect holding it all, placed where it still covers the
   * rect — no offset, and a share of the room between its two edges.
   */
  coversWholeFrame(): boolean {
    const box = this.box();
    return this.state.fit === 'cover'
      && this.state.cornerRadius <= 0
      && this.keepsCover(this.state.position.x)
      && this.keepsCover(this.state.position.y)
      && box.x <= 0
      && box.y <= 0
      && box.x + box.width >= this.frameWidth
      && box.y + box.height >= this.frameHeight
      && !this.isCutToRect();
  }

  /** Whether the layer stands exactly as its rect places it: opaque, unmoved, sharp and uncut. */
  isAtRest(): boolean {
    const { a, b, c, d, e, f } = this.state.transform;
    return this.state.opacity >= 1
      && a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0
      && this.state.blur <= 0
      && this.state.brightness === 1
      && !this.isClipped()
      && !this.isCutToRect();
  }

  /**
   * Draws `picture`, whose own size is `pictureWidth × pictureHeight`,
   * clipped to its visible box with rounded corners, in the state: its
   * opacity multiplies the context's; its transform moves the picture
   * and its clip together about the box's centre; its clip inset hides
   * that much of the box on top of the rounded clip; its blur softens
   * and its brightness lightens or darkens the picture inside the clip,
   * where the context can filter (one that cannot draws it as it is).
   * A picture fitted inside its box is drawn over the box's fill, where
   * it has one: its background colour, then a copy of the picture
   * covering the box, blurred (sharp where the context cannot filter).
   * A clip rect, where the layer has one, cuts it on top of all that,
   * moving with it.
   * Leaves the context's clip, transform, filter
   * and state as it found them. A picture or a box with no area, no
   * opacity, or an inset hiding the whole box draws nothing.
   */
  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    picture: FootagePicture,
    pictureWidth: number,
    pictureHeight: number,
  ): void {
    if (!(pictureWidth > 0 && pictureHeight > 0)) return;
    const box = this.box();
    if (!(box.width > 0 && box.height > 0)) return;
    if (!(this.state.opacity > 0)) return;
    const { top, right, bottom, left } = this.state.clipInset;
    if (left + right >= 1 || top + bottom >= 1) return;
    const target = this.pictureBox(pictureWidth, pictureHeight);
    context.save();
    try {
      const atRest = this.isAtRest();
      if (!atRest) this.applyTransform(context, box);
      if (!(atRest && this.coversWholeFrame())) this.clipTo(context, pictureWidth, pictureHeight);
      if (this.isClipped()) this.clipInsetTo(context, box);
      if (this.isCutToRect()) this.clipToRect(context);
      if (this.isFilled()) this.drawFill(context, picture, pictureWidth, pictureHeight, box);
      const filter = this.filterOf();
      if (filter !== '') context.filter = filter;
      picture.draw(context, target.x, target.y, target.width, target.height);
    } finally {
      context.restore();
    }
  }

  /**
   * The box's fill, inside the clip: its colour, then the picture
   * covering the box, grown a little past it so the blur does not fade
   * at its edges, and blurred by the fill's radius on top of the layer's
   * own filter.
   */
  private drawFill(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    picture: FootagePicture,
    pictureWidth: number,
    pictureHeight: number,
    box: FootageBox,
  ): void {
    if (this.state.backgroundColor !== null) {
      context.fillStyle = this.state.backgroundColor;
      context.fillRect(box.x, box.y, box.width, box.height);
    }
    if (!(this.state.fillBlur > 0)) return;
    const scale = Math.max(box.width / pictureWidth, box.height / pictureHeight) * FILL_GROWTH;
    const width = pictureWidth * scale;
    const height = pictureHeight * scale;
    const blur = `blur(${this.state.fillBlur * Math.min(this.frameWidth, this.frameHeight)}px)`;
    context.filter = [blur, this.filterOf()].filter((part) => part !== '').join(' ');
    picture.draw(context, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
    context.filter = 'none';
  }

  private keepsCover(position: FootageAxisPosition): boolean {
    return position.offset === 0 && position.share >= 0 && position.share <= 1;
  }

  /** The blur and the brightness as a canvas filter; empty where the picture is drawn as it is. */
  private filterOf(): string {
    const parts: string[] = [];
    if (this.state.blur > 0) parts.push(`blur(${this.state.blur * Math.min(this.frameWidth, this.frameHeight)}px)`);
    if (this.state.brightness !== 1) parts.push(`brightness(${this.state.brightness})`);
    return parts.join(' ');
  }

  /** Whether the layer's clip rect cuts anything: one that leaves the whole frame square-cornered cuts nothing. */
  private isCutToRect(): boolean {
    const rect = this.state.clipRect;
    if (rect === null) return false;
    return this.state.clipRadius > 0
      || rect.x > 0 || rect.y > 0 || rect.x + rect.width < 1 || rect.y + rect.height < 1;
  }

  /** Narrows the clip to the layer's clip rect, its corners rounded, never more than half its shorter side. */
  private clipToRect(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): void {
    const rect = this.state.clipRect!;
    const x = rect.x * this.frameWidth;
    const y = rect.y * this.frameHeight;
    const width = rect.width * this.frameWidth;
    const height = rect.height * this.frameHeight;
    const radius = Math.max(0, Math.min(this.state.clipRadius * Math.min(this.frameWidth, this.frameHeight), Math.min(width, height) / 2));
    context.beginPath();
    if (radius > 0) context.roundRect(x, y, width, height, radius);
    else context.rect(x, y, width, height);
    context.clip();
  }

  private isClipped(): boolean {
    const { top, right, bottom, left } = this.state.clipInset;
    return top > 0 || right > 0 || bottom > 0 || left > 0;
  }

  /** Fades, then applies the transform about the box's centre, its move in fractions of the frame. */
  private applyTransform(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, box: FootageBox): void {
    context.globalAlpha *= Math.min(1, this.state.opacity);
    const { a, b, c, d, e, f } = this.state.transform;
    const centreX = box.x + box.width / 2;
    const centreY = box.y + box.height / 2;
    context.translate(centreX + e * this.frameWidth, centreY + f * this.frameHeight);
    context.transform(a, b, c, d, 0, 0);
    context.translate(-centreX, -centreY);
  }

  private clipTo(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    pictureWidth: number,
    pictureHeight: number,
  ): void {
    const visible = this.visibleBox(pictureWidth, pictureHeight);
    const radius = this.cornerRadiusPx(pictureWidth, pictureHeight);
    context.beginPath();
    if (radius > 0) context.roundRect(visible.x, visible.y, visible.width, visible.height, radius);
    else context.rect(visible.x, visible.y, visible.width, visible.height);
    context.clip();
  }

  /** Narrows the clip to the box less the inset on each side. */
  private clipInsetTo(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, box: FootageBox): void {
    const { top, right, bottom, left } = this.state.clipInset;
    context.beginPath();
    context.rect(
      box.x + box.width * left,
      box.y + box.height * top,
      box.width * (1 - left - right),
      box.height * (1 - top - bottom),
    );
    context.clip();
  }
}
