import type { GraphicCheckFrame, GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import { GraphicMessageTranscript } from '@core/graphics/services/GraphicMessageTranscript';

// Past this a graphic is taken never to finish opening: code that loops forever as it starts never does.
// A graphic is checked on the pictures it hands over at its box's own size.
const BOX_SIZE = 1;
const OPEN_TIMEOUT_MS = 8_000;
// For all the pictures of one check together, so a graphic stuck drawing costs a bounded wait.
const FRAMES_TIMEOUT_MS = 15_000;
// The alpha from which a pixel hides what is under it, as a byte: 0.8 of solid.
const PAINTED_ALPHA = 204;

/**
 * Plays a graphic once, on its own, to see what it does: whether it
 * opens, its picture at each time asked with the shares of it holding
 * anything and painted solid, what its code logged or threw, in order,
 * and the moments it declared. Opened for the check alone and closed after, however it ends.
 *
 * A graphic that takes longer than a few seconds to open is reported as
 * not opened; pictures share a budget of time, past which the rest are
 * reported as not drawn. So a check always ends, unless the graphic's
 * code holds the editor's own thread, which only a browser that runs the
 * graphic's frame apart from the page can prevent.
 */
export class GraphicCheck {
  constructor(private readonly players: GraphicPlayerFactory) {}

  /**
   * Plays `document` on `stage` and reports what it did. `times` are
   * seconds since the graphic appears; each is clamped to how long it
   * shows (a time past its end draws its end), and each distinct one is
   * drawn once, in order of time. The pictures are the caller's to close.
   * Rejects only with `signal`'s reason, once it aborts.
   */
  async check(document: GraphicDocument, stage: GraphicStage, times: ReadonlyArray<number>, signal: AbortSignal): Promise<GraphicCheckReport> {
    signal.throwIfAborted();
    const transcript = new GraphicMessageTranscript();
    let player: GraphicPlayer;
    try {
      player = await this.open(document, stage, transcript, signal);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return { ...this.boxOf(stage), opened: false, openError: this.describe(error), frames: [], messages: transcript.messages(), moments: [] };
    }
    try {
      const frames = await this.framesOf(player, this.timesOf(times, stage.durationSec), signal);
      return { ...this.boxOf(stage), opened: true, openError: null, frames, messages: transcript.messages(), moments: player.moments };
    } finally {
      player.dispose();
    }
  }

  private open(document: GraphicDocument, stage: GraphicStage, transcript: GraphicMessageTranscript, signal: AbortSignal): Promise<GraphicPlayer> {
    const opening = this.players.open(document, stage, (message) => transcript.record(message), BOX_SIZE);
    const timeout = `it was not ready within ${OPEN_TIMEOUT_MS} ms; code that never finishes as it starts, such as a loop with no end, does that`;
    return this.within(opening, signal, OPEN_TIMEOUT_MS, timeout, (late) => late.dispose());
  }

  private boxOf(stage: GraphicStage): Pick<GraphicCheckReport, 'widthPx' | 'heightPx' | 'durationSec'> {
    return { widthPx: stage.widthPx, heightPx: stage.heightPx, durationSec: stage.durationSec };
  }

  /** The times to draw: within the graphic's length, each once, in order. A time that is not a number is dropped. */
  private timesOf(times: ReadonlyArray<number>, durationSec: number): number[] {
    const clamped = times.map((sec) => Math.min(Math.max(0, sec), durationSec)).filter((sec) => Number.isFinite(sec));
    return [...new Set(clamped)].sort((first, second) => first - second);
  }

  /** Asked in order of time, so a graphic running on its own clock is never played again from its start. */
  private async framesOf(player: GraphicPlayer, times: ReadonlyArray<number>, signal: AbortSignal): Promise<GraphicCheckFrame[]> {
    const deadlineMs = performance.now() + FRAMES_TIMEOUT_MS;
    const frames: GraphicCheckFrame[] = [];
    try {
      for (const sec of times) frames.push(await this.frameOf(player, sec, deadlineMs - performance.now(), signal));
      return frames;
    } catch (error) {
      for (const frame of frames) frame.bitmap?.close();
      throw error;
    }
  }

  private async frameOf(player: GraphicPlayer, sec: number, leftMs: number, signal: AbortSignal): Promise<GraphicCheckFrame> {
    if (leftMs <= 0) return this.undrawn(sec, `not drawn: the ${FRAMES_TIMEOUT_MS} ms a check gives its pictures ran out first`);
    let bitmap: ImageBitmap;
    try {
      const timeout = `not drawn within the ${Math.round(leftMs)} ms left of the check's time for pictures`;
      bitmap = await this.within(player.frameAt(sec), signal, leftMs, timeout, (late) => late.close());
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return this.undrawn(sec, this.describe(error));
    }
    try {
      return { sec, bitmap, ...this.sharesOf(bitmap), error: null, text: player.textLayout() };
    } catch (error) {
      bitmap.close();
      throw error;
    }
  }

  private undrawn(sec: number, error: string): GraphicCheckFrame {
    return { sec, bitmap: null, drawnShare: 0, paintedShare: 0, error, text: null };
  }

  /** The shares of the picture's pixels that are not fully transparent, and that are painted all but solid. */
  private sharesOf(bitmap: ImageBitmap): Pick<GraphicCheckFrame, 'drawnShare' | 'paintedShare'> {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('No 2D canvas context to read a picture with');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const count = pixels.length / 4;
    if (count === 0) return { drawnShare: 0, paintedShare: 0 };
    let drawn = 0;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index] ?? 0;
      if (alpha > 0) drawn += 1;
      if (alpha >= PAINTED_ALPHA) painted += 1;
    }
    return { drawnShare: drawn / count, paintedShare: painted / count };
  }

  /**
   * What `work` gives, unless `signal` aborts first, which rejects with
   * its reason, or `timeoutMs` passes first, which rejects with an error
   * saying `timeoutMessage`. What `work` gives once it is given up on is
   * handed to `discard`.
   */
  private within<T>(work: Promise<T>, signal: AbortSignal, timeoutMs: number, timeoutMessage: string, discard: (late: T) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        work.then(discard, () => undefined);
        reject(signal.reason);
        return;
      }
      let settled = false;
      const onAbort = (): void => giveUp(signal.reason);
      const timer = setTimeout(() => giveUp(new Error(timeoutMessage)), timeoutMs);
      const settle = (): boolean => {
        if (settled) return false;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        return true;
      };
      const giveUp = (reason: unknown): void => {
        if (!settle()) return;
        work.then(discard, () => undefined);
        reject(reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      work.then(
        (value) => { if (settle()) resolve(value); },
        (error: unknown) => { if (settle()) reject(error); },
      );
    });
  }

  /** An error as text, with the causes it carries: an error of this editor names what failed, its cause why. */
  private describe(error: unknown): string {
    const parts: string[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth += 1) {
      parts.push(current instanceof Error ? current.message : String(current));
      current = current instanceof Error ? current.cause : undefined;
    }
    return parts.join(': ');
  }
}
