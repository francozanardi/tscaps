import { GraphicFrameFailedError } from '@core/graphics/domain/errors/GraphicFrameFailedError';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { GraphicTextLayout } from '@core/graphics/domain/GraphicTextLayout';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import type { GraphicPictureSize } from '@core/graphics/infrastructure/sandbox/GraphicPictureSize';

/** What the frame answers on its port. */
type FrameAnswer =
  | { readonly type: 'ready'; readonly moments: ReadonlyArray<GraphicMoment> }
  | { readonly type: 'frame'; readonly id: number; readonly bitmap?: ImageBitmap; readonly svg?: string; readonly usesClock: boolean; readonly text?: GraphicTextLayout }
  | { readonly type: 'failed'; readonly id: number; readonly message: string }
  | { readonly type: 'message'; readonly level: GraphicMessage['level']; readonly text: string };

interface PendingFrame {
  resolve: (bitmap: ImageBitmap) => void;
  reject: (error: Error) => void;
}

// Time for the page to load its code and say it is ready, and for one frame to be drawn.
const READY_TIMEOUT_MS = 10_000;
const FRAME_TIMEOUT_MS = 5_000;
// In view but invisible: Chrome throttles a cross-origin frame placed out of view, laying it out late or not at all.
const HIDDEN_FRAME_STYLE = 'position:fixed;left:0;top:0;border:0;opacity:0;pointer-events:none;';

/**
 * A graphic played in a sandboxed `iframe`: scripts run, nothing else is
 * allowed (no same origin, so it reads none of the editor's storage and
 * reaches none of its DOM; no popups, forms, modals or navigation), and
 * it is spoken to only through a `MessagePort` handed to it once loaded.
 *
 * Frames are asked one at a time. Going back to an earlier frame of a
 * graphic whose code asked for time to pass (frame callbacks, timers)
 * loads its page again and plays it from its start; one drawn as a pure
 * function of time is asked directly.
 *
 * A page of HTML is drawn from the SVG image of itself, and only when
 * that image changed: a frame whose page reads the same as the one last
 * drawn is handed the picture already drawn, which is most frames of a
 * graphic once it has come to rest.
 *
 * Sized to the graphic's box and kept off screen in `container`. Its
 * pictures hold `picture`'s pixels: the box's, or fewer, the page laid
 * out in its box all the same.
 */
export class SandboxedGraphicPlayer implements GraphicPlayer {
  private readonly frame: HTMLIFrameElement;
  private port: MessagePort | null = null;
  private readonly pending = new Map<number, PendingFrame>();
  private nextRequestId = 1;
  private drawnFrame = -1;
  private usesClock = false;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  // The page's picture as last drawn, and the SVG it was drawn from.
  private readonly drawn: OffscreenCanvas;
  private drawnSvg: string | null = null;
  private declaredMoments: ReadonlyArray<GraphicMoment> = [];
  private lastText: GraphicTextLayout | null = null;

  constructor(
    container: HTMLElement,
    private readonly page: string,
    private readonly stage: GraphicStage,
    private readonly picture: GraphicPictureSize,
    private readonly onMessage: (message: GraphicMessage) => void,
  ) {
    this.frame = container.ownerDocument.createElement('iframe');
    this.frame.setAttribute('sandbox', 'allow-scripts');
    this.frame.setAttribute('aria-hidden', 'true');
    this.frame.tabIndex = -1;
    this.frame.title = 'Graphic';
    this.frame.width = String(stage.widthPx);
    this.frame.height = String(stage.heightPx);
    this.frame.style.cssText = `${HIDDEN_FRAME_STYLE}width:${stage.widthPx}px;height:${stage.heightPx}px;`;
    this.drawn = new OffscreenCanvas(picture.widthPx, picture.heightPx);
    container.append(this.frame);
  }

  /** Loads the page and waits until the graphic's code has run and it says it is ready. */
  async load(): Promise<void> {
    this.port?.close();
    this.port = null;
    this.drawnFrame = -1;
    // A page whose code never returns as it starts never loads; refused, it is closed rather than kept waiting forever.
    const loaded = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`The graphic's page did not load within ${READY_TIMEOUT_MS} ms`)), READY_TIMEOUT_MS);
      this.frame.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
    });
    this.frame.srcdoc = this.page;
    await loaded;
    const channel = new MessageChannel();
    const ready = this.readyOn(channel.port1);
    this.port = channel.port1;
    this.frame.contentWindow?.postMessage({ type: 'tscaps-graphic-connect' }, '*', [channel.port2]);
    await ready;
  }

  get moments(): ReadonlyArray<GraphicMoment> {
    return this.declaredMoments;
  }

  frameAt(sec: number): Promise<ImageBitmap> {
    const frame = this.frameOf(sec);
    const drawn = this.queue.then(() => this.draw(frame));
    this.queue = drawn.catch(() => undefined);
    return drawn;
  }

  frameOf(sec: number): number {
    return Math.max(0, Math.round(sec * this.stage.fps));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.port?.close();
    this.port = null;
    for (const pending of this.pending.values()) pending.reject(new GraphicFrameFailedError({ cause: new Error('The graphic was closed') }));
    this.pending.clear();
    this.frame.remove();
  }

  textLayout(): GraphicTextLayout | null {
    return this.lastText;
  }

  private async draw(frame: number): Promise<ImageBitmap> {
    if (this.disposed) throw new GraphicFrameFailedError({ cause: new Error('The graphic was closed') });
    if (frame < this.drawnFrame && this.usesClock) await this.load();
    const bitmap = await this.request(frame);
    this.drawnFrame = frame;
    return bitmap;
  }

  private request(frame: number): Promise<ImageBitmap> {
    const port = this.port;
    if (port === null) return Promise.reject(new GraphicFrameFailedError({ cause: new Error('The graphic is not loaded') }));
    const id = this.nextRequestId++;
    return new Promise<ImageBitmap>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new GraphicFrameFailedError({ cause: new Error(`Frame ${frame} took longer than ${FRAME_TIMEOUT_MS} ms`) }));
      }, FRAME_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (bitmap) => { clearTimeout(timeout); resolve(bitmap); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      });
      port.postMessage({ type: 'frame', id, frame });
    });
  }

  /** The picture of the page as `svg` shows it: drawn afresh where `svg` is not what the picture held was drawn from. */
  private async pictureOf(svg: string): Promise<ImageBitmap> {
    if (svg !== this.drawnSvg) {
      this.drawnSvg = null;
      await this.drawSvg(svg);
      this.drawnSvg = svg;
    }
    return createImageBitmap(this.drawn);
  }

  // Drawn here, in the editor's origin, as an image, which runs no script and loads nothing. Drawn onto a
  // canvas rather than made a bitmap of directly: Chromium marks a bitmap made from an SVG image of HTML as
  // another origin's, while the same image drawn on a canvas leaves it readable.
  private async drawSvg(svg: string): Promise<void> {
    const image = new Image(this.stage.widthPx, this.stage.heightPx);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const context = this.drawn.getContext('2d');
    context?.clearRect(0, 0, this.picture.widthPx, this.picture.heightPx);
    context?.drawImage(image, 0, 0, this.picture.widthPx, this.picture.heightPx);
  }

  private readyOn(port: MessagePort): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`The graphic was not ready within ${READY_TIMEOUT_MS} ms`)), READY_TIMEOUT_MS);
      port.onmessage = (event: MessageEvent<FrameAnswer>) => {
        if (event.data.type === 'ready') {
          clearTimeout(timeout);
          this.declaredMoments = event.data.moments;
          resolve();
          return;
        }
        this.answer(event.data);
      };
    });
  }

  private answer(answer: FrameAnswer): void {
    switch (answer.type) {
      case 'frame': {
        this.usesClock = this.usesClock || answer.usesClock;
        this.lastText = answer.text ?? null;
        const pending = this.pending.get(answer.id);
        this.pending.delete(answer.id);
        if (pending === undefined) return;
        if (answer.bitmap !== undefined) pending.resolve(answer.bitmap);
        else this.pictureOf(answer.svg ?? '').then(pending.resolve, (error: unknown) => pending.reject(new GraphicFrameFailedError({ cause: error })));
        return;
      }
      case 'failed':
        this.pending.get(answer.id)?.reject(new GraphicFrameFailedError({ cause: new Error(answer.message) }));
        this.pending.delete(answer.id);
        return;
      case 'message':
        this.onMessage({ level: answer.level, text: answer.text });
        return;
      case 'ready':
        return;
    }
  }
}
