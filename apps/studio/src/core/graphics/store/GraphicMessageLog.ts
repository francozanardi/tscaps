import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';

// How many lines a graphic keeps: enough to read what it said lately, few enough that a loop logging every frame costs nothing.
const MAX_LINES = 50;
// One empty log for every graphic that said nothing, so a reader asking twice gets the same answer.
const NOTHING: ReadonlyArray<GraphicMessage> = [];

/**
 * What each graphic's code said lately — the lines it logged and the
 * errors it threw — newest last, by the id of the layer showing it.
 *
 * A graphic that starts over (its document changed) starts a new log.
 * Subscribers hear every change; reading is synchronous, and gives the
 * same array until the graphic's log changes.
 */
export class GraphicMessageLog {
  private readonly lines = new Map<string, ReadonlyArray<GraphicMessage>>();
  private readonly listeners = new Set<() => void>();

  /** The lines the graphic of `layerId` said, oldest first; empty for one that said nothing. */
  of(layerId: string): ReadonlyArray<GraphicMessage> {
    return this.lines.get(layerId) ?? NOTHING;
  }

  record(layerId: string, message: GraphicMessage): void {
    const held = this.of(layerId);
    this.lines.set(layerId, [...held.slice(Math.max(0, held.length - MAX_LINES + 1)), message]);
    this.notify();
  }

  /** Forgets what the graphic of `layerId` said, as it starts over. */
  restart(layerId: string): void {
    if (!this.lines.has(layerId)) return;
    this.lines.delete(layerId);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
