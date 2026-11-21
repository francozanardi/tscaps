import {
  type FootageLayer,
  type FootagePictureProvider,
  type FootageSource,
} from '@tscaps/engine';
import {
  FootageLayerSchedule,
  SourcePictureAsIs,
  SourcePicturePlacement,
  type AnimatedImageOpener,
  type FootageCompositionRequest,
  type FootageCompositor,
  type FootageLayerPicture,
  type FootagePass,
  type FootagePicture,
  type PlacedSourcePicture,
} from '@tscaps/engine/advanced';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';
import type { PreviewFootageLayer } from '@core/preview/domain/PreviewFootageLayer';
import type { PreviewShownPicture } from '@core/preview/domain/PreviewShownPicture';
import type { PreviewSourceLoader } from '@core/preview/domain/PreviewSourceLoader';
import type { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';
import type { FootagePlayer } from '@core/preview/infrastructure/footage/FootagePlayer';
import { BackdropFootagePlayer } from '@core/preview/infrastructure/footage/BackdropFootagePlayer';
import { AnimatedFootagePlayer } from '@core/preview/infrastructure/footage/AnimatedFootagePlayer';
import { ProvidedFootagePlayer } from '@core/preview/infrastructure/footage/ProvidedFootagePlayer';
import { StillFootagePlayer } from '@core/preview/infrastructure/footage/StillFootagePlayer';
import { VideoFootagePlayer } from '@core/preview/infrastructure/footage/VideoFootagePlayer';

type FootageLayerMode = 'paused' | 'playing' | 'scrubbing';

// How far before the output's end its last frame is drawn: inside every layer that lasts to the end, and too
// short to see any motion move.
const LAST_FRAME_LEAD_SEC = 0.001;

interface FrameSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * {@link PreviewFootageLayer} composing onto a `<canvas>` of its own,
 * through the same compositor the export uses, one player per pass of
 * a layer.
 *
 * Players are kept for every pass on screen and for the next one to
 * start, which starts decoding from its first moment as soon as it is
 * next, so its frames are waiting when playback reaches it. Each pass of
 * a looping layer is a pass of its own, so starting over is a hand-over
 * like any other and never a fresh seek.
 *
 * A layer shows once its pass on screen has a picture; a layer showing
 * the host's own picture has it as soon as the host does, and needs no
 * player. While any does, the canvas is composed every animation frame,
 * the host's picture included, so it follows the host even while
 * paused — unless what it would draw is the host's picture as it is
 * ({@link SourcePictureAsIs}), which the host already shows beneath it.
 * A grade over the whole picture shows the canvas wherever there is a
 * host picture to grade, with or without a layer.
 * A layer of provided pictures whose provider changed keeps showing its
 * last picture until the new one draws its first, so editing what draws
 * it never blinks it out.
 * Each composition asks the footage how every layer on screen is drawn
 * at that moment. Where backdrop layers draw the picture again, the
 * picture beneath the first of them is composed too, on a canvas of its
 * own, for anything cutting the picture to lay it over again.
 */
export class CanvasPreviewFootageLayer extends EventTarget implements PreviewFootageLayer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private time: PlaybackTimeSource | null = null;
  private video: HTMLCanvasElement | HTMLVideoElement | null = null;
  private frameSize: FrameSize | null = null;
  private footage: PreviewFootage | null = null;
  private schedule = new FootageLayerSchedule([]);
  // The layers that show a file of their own, which are the ones a player plays.
  private playable = new FootageLayerSchedule([]);
  private players: FootagePlayer[] = [];
  // By layer id: the player of provided pictures a new one replaced, kept showing until the new one has a picture.
  private standIns = new Map<string, FootagePlayer>();
  private showing = false;
  // The picture beneath the backdrop layers of the frame last drawn, where any are active.
  private beneathBackdrops: HTMLCanvasElement | null = null;
  private showsBeneathBackdrops = false;
  // Where the video's own picture landed on the picture to cut from of the frame last drawn.
  private sourcePicture: PlacedSourcePicture | null = null;
  private mode: FootageLayerMode = 'paused';
  private frameRequestId = 0;

  constructor(
    private readonly loader: PreviewSourceLoader,
    private readonly resolutionCap: PreviewResolutionCap,
    private readonly compositor: FootageCompositor,
    private readonly animations: AnimatedImageOpener,
  ) {
    super();
  }

  mount(container: HTMLElement, time: PlaybackTimeSource, video: HTMLCanvasElement | HTMLVideoElement): void {
    this.time = time;
    this.video = video;
    if (!this.canvas) this.buildCanvas();
    if (this.canvas && this.canvas.parentElement !== container) container.appendChild(this.canvas);
  }

  unmount(): void {
    this.clear();
    this.canvas?.remove();
    this.canvas = null;
    this.context = null;
    this.time = null;
    this.video = null;
  }

  setFrameSize(widthPx: number, heightPx: number): void {
    this.frameSize = { widthPx, heightPx };
    this.applyFrameSize();
  }

  setFootage(footage: PreviewFootage): void {
    const samePlayback = this.samePlayback(footage.layers);
    this.footage = footage;
    this.applyFrameSize();
    this.schedule = new FootageLayerSchedule(footage.layers);
    this.playable = new FootageLayerSchedule(footage.layers.filter((layer) => layer.source.kind !== 'source-picture'));
    // A change in how the layers look plays nothing new: drawing again
    // is enough, and touching the players would seek them for nothing.
    if (samePlayback) this.recompose();
    else this.resumeAtCurrentTime();
  }

  playFrom(requestedSec: number): void {
    const outputSec = this.onScreenAt(requestedSec);
    this.mode = 'playing';
    this.reconcile(outputSec);
    for (const player of this.players) {
      if (this.covers(player.pass, outputSec) || !player.isStreaming()) player.stream(outputSec);
    }
    this.compose(outputSec);
    this.requestFrames();
  }

  pause(): void {
    this.mode = 'paused';
    for (const player of this.players) player.idle();
  }

  showStillAt(requestedSec: number): void {
    const outputSec = this.onScreenAt(requestedSec);
    this.mode = 'paused';
    this.reconcile(outputSec);
    for (const player of this.players) {
      if (this.covers(player.pass, outputSec)) player.still(outputSec);
      else player.idle();
    }
    this.compose(outputSec);
    this.requestFrames();
  }

  beginScrub(): void {
    this.mode = 'scrubbing';
  }

  scrubTo(requestedSec: number): void {
    const outputSec = this.onScreenAt(requestedSec);
    this.reconcile(outputSec);
    for (const player of this.players) {
      if (this.covers(player.pass, outputSec)) player.scrub(outputSec);
      else player.idle();
    }
    this.compose(outputSec);
    this.requestFrames();
  }

  endScrub(): void {
    if (this.mode !== 'scrubbing') return;
    this.mode = 'paused';
    for (const player of this.players) player.idle();
  }

  clear(): void {
    this.mode = 'paused';
    this.cancelFrames();
    for (const player of this.players) player.dispose();
    this.players = [];
    this.dropStandIns(() => true);
    this.context?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    this.setShowing(false);
  }

  shownPicture(): PreviewShownPicture | null {
    if (!this.showing || this.canvas === null) return null;
    const canvas = this.showsBeneathBackdrops && this.beneathBackdrops !== null ? this.beneathBackdrops : this.canvas;
    return { canvas, sourcePicture: this.sourcePicture };
  }

  isShowing(): boolean {
    return this.showing;
  }

  captureStream(): MediaStream | null {
    const candidate = this.canvas as (HTMLCanvasElement & { captureStream?: () => MediaStream }) | null;
    if (!candidate || typeof candidate.captureStream !== 'function') return null;
    return candidate.captureStream();
  }

  private buildCanvas(): void {
    const canvas = document.createElement('canvas');
    canvas.dataset.previewFootage = '';
    canvas.style.position = 'absolute';
    canvas.style.left = '-1px';
    canvas.style.top = '-1px';
    canvas.style.width = 'calc(100% + 2px)';
    canvas.style.height = 'calc(100% + 2px)';
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    canvas.style.pointerEvents = 'none';
    canvas.style.visibility = 'hidden';
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.applyFrameSize();
  }

  private applyFrameSize(): void {
    if (!this.canvas || !this.frameSize) return;
    const uncapped = this.footageFrameSize(this.frameSize);
    const target = this.resolutionCap.clamp(uncapped.widthPx, uncapped.heightPx);
    if (this.canvas.width !== target.widthPx) this.canvas.width = target.widthPx;
    if (this.canvas.height !== target.heightPx) this.canvas.height = target.heightPx;
  }

  /**
   * The footage's frame at the host picture's sharpness: the frame's
   * shape, its shorter side the picture's. The picture's own size while
   * no footage says otherwise.
   */
  private footageFrameSize(picture: FrameSize): FrameSize {
    const frame = this.footage?.frame ?? null;
    if (frame === null) return picture;
    const shape = frame.width / frame.height;
    if (!(Number.isFinite(shape) && shape > 0)) return picture;
    const shorterSide = Math.min(picture.widthPx, picture.heightPx);
    if (shape >= 1) return { widthPx: Math.round(shorterSide * shape), heightPx: shorterSide };
    return { widthPx: shorterSide, heightPx: Math.round(shorterSide / shape) };
  }

  private recompose(): void {
    if (!this.time) return;
    this.compose(this.onScreenAt(this.time.currentOutputTimeSec()));
    this.requestFrames();
  }

  private resumeAtCurrentTime(): void {
    if (!this.time) return;
    const outputSec = this.onScreenAt(this.time.currentOutputTimeSec());
    if (this.mode === 'playing') {
      this.follow(outputSec);
      this.compose(outputSec);
      this.requestFrames();
    } else if (this.mode === 'scrubbing') this.scrubTo(outputSec);
    else this.showStillAt(outputSec);
  }

  /** Keeps a player on every pass on screen and on the next one to start, and on nothing else. */
  private reconcile(outputSec: number): void {
    const wanted = this.playable.passesAt(outputSec);
    const next = this.playable.nextPassAfter(outputSec);
    if (next !== null) wanted.push(next);
    this.players = this.players.filter((player) => {
      const keep = wanted.some((pass) => this.samePass(pass, player.pass));
      if (!keep && !this.standsIn(player, wanted)) player.dispose();
      return keep;
    });
    this.dropStandIns((layerId) => !wanted.some((pass) => pass.layer.id === layerId));
    for (const pass of wanted) {
      if (!this.players.some((player) => this.samePass(player.pass, pass))) this.players.push(this.openPlayer(pass));
    }
  }

  private openPlayer(pass: FootagePass): FootagePlayer {
    const player = this.playerFor(pass);
    player.open();
    return player;
  }

  private playerFor(pass: FootagePass): FootagePlayer {
    const source = pass.layer.source;
    switch (source.kind) {
      case 'image':
        return new StillFootagePlayer(pass, source.blob, this.resolutionCap, this.onPassPainted);
      case 'gif':
        return new AnimatedFootagePlayer(pass, source.blob, this.animations, this.schedule, this.readTime(), this.onPassPainted);
      case 'video':
        return new VideoFootagePlayer(pass, source.blob, this.loader, this.readTime(), this.onPassPainted);
      case 'backdrop':
        return new BackdropFootagePlayer(pass, this.onPassPainted);
      case 'provided':
        return new ProvidedFootagePlayer(pass, source.provider, this.schedule, this.readTime(), this.onPassPainted, this.pictureScale());
      case 'source-picture':
        throw new Error('A layer showing the host\'s own picture has no file to play.');
    }
  }

  /**
   * How large this layer draws a picture made for the footage's frame,
   * as a share of its full size: its canvas over that frame, and never
   * more than the picture has.
   */
  private pictureScale(): number {
    const frame = this.footage?.frame ?? null;
    if (frame === null || this.canvas === null || !(frame.width > 0)) return 1;
    return Math.min(1, this.canvas.width / frame.width);
  }

  private readonly onPassPainted = (): void => {
    if (!this.time) return;
    this.compose(this.onScreenAt(this.time.currentOutputTimeSec()));
    this.requestFrames();
  };

  private follow(outputSec: number): void {
    this.reconcile(outputSec);
    for (const player of this.players) {
      if (!player.isStreaming()) player.stream(outputSec);
    }
  }

  /**
   * Runs one animation frame at a time while playing, or while a layer
   * shows — the host's picture beneath it can change while paused, as a
   * seek lands.
   */
  private requestFrames(): void {
    if (this.frameRequestId !== 0 || !this.drawsAnything()) return;
    const tick = (): void => {
      this.frameRequestId = 0;
      if (!this.time) return;
      const outputSec = this.onScreenAt(this.time.currentOutputTimeSec());
      if (this.mode === 'playing') this.follow(outputSec);
      this.compose(outputSec);
      if (this.mode === 'playing' || this.showing) this.frameRequestId = requestAnimationFrame(tick);
    };
    this.frameRequestId = requestAnimationFrame(tick);
  }

  /** Whether there is anything to draw over the host's picture: a layer, or a grade over all of it. */
  private drawsAnything(): boolean {
    return !this.schedule.isEmpty() || (this.footage?.grade ?? null) !== null;
  }

  private cancelFrames(): void {
    cancelAnimationFrame(this.frameRequestId);
    this.frameRequestId = 0;
  }

  /**
   * Draws the picture at `outputSec` and shows the canvas, or hides it
   * where no layer has a picture there, or the layers would draw the
   * host's picture as it is.
   */
  private compose(outputSec: number): void {
    const request = this.requestAt(outputSec);
    const shows = request !== null && !new SourcePictureAsIs().holds(request);
    this.setShowing(shows);
    if (!shows || !this.context) return;
    this.context.clearRect(0, 0, request.width, request.height);
    this.compositor.compose(this.context, request);
    const firstBackdrop = request.layers.findIndex((entry) => entry.layer.source.kind === 'backdrop');
    const beneath = firstBackdrop === -1 ? request : { ...request, layers: request.layers.slice(0, firstBackdrop) };
    this.showsBeneathBackdrops = firstBackdrop !== -1 && this.composeBeneathBackdrops(beneath);
    this.sourcePicture = new SourcePicturePlacement(beneath).placed();
  }

  /** Composes `beneath` on the canvas kept for the picture beneath the backdrops; false where it cannot be drawn. */
  private composeBeneathBackdrops(beneath: FootageCompositionRequest): boolean {
    if (this.beneathBackdrops === null) this.beneathBackdrops = document.createElement('canvas');
    if (this.beneathBackdrops.width !== beneath.width) this.beneathBackdrops.width = beneath.width;
    if (this.beneathBackdrops.height !== beneath.height) this.beneathBackdrops.height = beneath.height;
    const context = this.beneathBackdrops.getContext('2d');
    if (context === null) return false;
    context.clearRect(0, 0, beneath.width, beneath.height);
    this.compositor.compose(context, beneath);
    return true;
  }

  private requestAt(outputSec: number): FootageCompositionRequest | null {
    if (!this.canvas || !this.frameSize) return null;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return null;
    const video = this.hostPicture();
    const layers = this.picturesAt(outputSec, video);
    const grade = this.footage?.grade ?? null;
    if (layers.length === 0 && grade === null) return null;
    return {
      width,
      height,
      video,
      videoWidth: this.frameSize.widthPx,
      videoHeight: this.frameSize.heightPx,
      layers,
      ...(grade === null ? {} : { grade }),
    };
  }

  /**
   * The picture of each pass on screen that has one, bottom to top, in
   * the state the footage answers for its layer now — a player opened for
   * an earlier set keeps playing a layer that only moved. A layer showing
   * the host's own picture has `video`, at the host's size.
   */
  private picturesAt(outputSec: number, video: FootagePicture | null): FootageLayerPicture[] {
    const held: Array<Omit<FootageLayerPicture, 'state'>> = [];
    for (const pass of this.schedule.passesAt(outputSec)) {
      const picture = this.pictureOf(pass, video);
      if (picture !== null) held.push({ layer: pass.layer, ...picture });
    }
    if (held.length === 0 || this.footage === null) return [];
    const resolved = this.footage.resolver.resolveAt(outputSec);
    return held.flatMap((entry) => {
      const state = resolved.find((candidate) => candidate.layer === entry.layer)?.state;
      return state === undefined ? [] : [{ ...entry, state }];
    });
  }

  private pictureOf(pass: FootagePass, video: FootagePicture | null): Omit<FootageLayerPicture, 'layer' | 'state'> | null {
    if (pass.layer.source.kind !== 'source-picture') {
      const picture = this.players.find((player) => this.samePass(player.pass, pass))?.picture() ?? null;
      if (picture !== null) {
        this.dropStandIns((layerId) => layerId === pass.layer.id);
        return picture;
      }
      return this.standIns.get(pass.layer.id)?.picture() ?? null;
    }
    if (video === null || !this.frameSize) return null;
    return { picture: video, width: this.frameSize.widthPx, height: this.frameSize.heightPx };
  }

  /**
   * Keeps `player`, which no wanted pass plays any more, standing in for
   * its layer while a new player of the same layer opens: provided
   * pictures start over whenever what draws them changes (a field, the
   * code, the size of the box, at every step of a drag), and the layer
   * would blink out until the new one draws. False, and nothing kept,
   * for any other footage, a player with no picture, or a layer no
   * longer wanted.
   */
  private standsIn(player: FootagePlayer, wanted: ReadonlyArray<FootagePass>): boolean {
    const { layer } = player.pass;
    if (layer.source.kind !== 'provided' || player.picture() === null) return false;
    if (!wanted.some((pass) => pass.layer.id === layer.id && pass.layer.source.kind === 'provided')) return false;
    const held = this.standIns.get(layer.id);
    if (held !== undefined && held !== player) held.dispose();
    // Held still: its last picture is what shows, and it draws no more.
    player.idle();
    this.standIns.set(layer.id, player);
    return true;
  }

  private dropStandIns(drops: (layerId: string) => boolean): void {
    for (const [layerId, player] of [...this.standIns]) {
      if (!drops(layerId)) continue;
      player.dispose();
      this.standIns.delete(layerId);
    }
  }

  private hostPicture(): FootagePicture | null {
    const video = this.video;
    if (!video) return null;
    return { draw: (context, dx, dy, dWidth, dHeight) => context.drawImage(video, dx, dy, dWidth, dHeight) };
  }

  private setShowing(showing: boolean): void {
    if (showing === this.showing) return;
    this.showing = showing;
    if (this.canvas) this.canvas.style.visibility = showing ? 'visible' : 'hidden';
    this.dispatchEvent(new Event('change'));
  }

  private covers(pass: FootagePass, outputSec: number): boolean {
    return outputSec >= pass.outputStartSec && outputSec < pass.outputEndSec;
  }

  /**
   * The instant the picture on screen stands for: the playhead, or just
   * before the output's end while the playhead rests on it, where the
   * video shows its last frame and every layer still on it is drawn.
   */
  private onScreenAt(outputSec: number): number {
    const endSec = this.footage?.outputEndSec ?? null;
    return endSec !== null && outputSec >= endSec ? endSec - LAST_FRAME_LEAD_SEC : outputSec;
  }

  private readTime(): PlaybackTimeSource {
    if (!this.time) throw new Error('The footage layer must be mounted before it plays.');
    return this.time;
  }

  /** Whether `layers` play what the footage held does, layer for layer, however they are drawn. */
  private samePlayback(layers: ReadonlyArray<FootageLayer>): boolean {
    const held = this.footage?.layers ?? [];
    return layers.length === held.length
      && layers.every((layer, index) => held[index] !== undefined && layer.id === held[index]!.id && this.playsTheSame(layer, held[index]!));
  }

  private samePass(a: FootagePass, b: FootagePass): boolean {
    return a.outputStartSec === b.outputStartSec && a.outputEndSec === b.outputEndSec && this.playsTheSame(a.layer, b.layer);
  }

  /** What `source` plays from: its file, or whoever provides its pictures; null for one drawn from the frame. */
  private contentOf(source: FootageSource): Blob | FootagePictureProvider | null {
    switch (source.kind) {
      case 'backdrop':
      case 'source-picture':
        return null;
      case 'provided':
        return source.provider;
      default:
        return source.blob;
    }
  }

  /** Whether two layers play the same footage at the same times, wherever they are drawn. */
  private playsTheSame(a: FootageLayer, b: FootageLayer): boolean {
    return this.contentOf(a.source) === this.contentOf(b.source)
      && a.source.kind === b.source.kind
      && a.outputStartSec === b.outputStartSec
      && a.outputEndSec === b.outputEndSec
      && a.sourceStartSec === b.sourceStartSec
      && a.sourcePassSec === b.sourcePassSec;
  }
}
