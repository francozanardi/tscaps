import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';

// A filmstrip's frames are the graphic's pictures at its box's own size.
const BOX_SIZE = 1;

/** The pictures of a graphic at moments evenly apart, to be played again in a loop. */
export interface GraphicFilmstrip {
  readonly frames: ReadonlyArray<ImageBitmap>;
  /** How long each frame shows, in seconds. */
  readonly frameSec: number;
}

/**
 * Plays a graphic once, with its fields' defaults, and keeps its
 * pictures at `fps` over its first `durationSec`: what a small loop of
 * it shows. The graphic is opened for the recording alone and closed
 * after, however it ends; what it logs is not kept. Rejects when it
 * cannot be opened or a picture cannot be drawn, closing the pictures
 * already taken.
 */
export class GraphicFilmstripRecorder {
  constructor(private readonly players: GraphicPlayerFactory) {}

  async record(graphic: Graphic, widthPx: number, heightPx: number, durationSec: number, fps: number): Promise<GraphicFilmstrip> {
    const params = Object.fromEntries(graphic.fields.map((field) => [field.id, graphic.params[field.id] ?? field.defaultValue]));
    const player = await this.players.open(
      graphic.document,
      { widthPx, heightPx, fps, seed: 1, durationSec, params },
      () => undefined,
      BOX_SIZE,
    );
    const frames: ImageBitmap[] = [];
    try {
      const count = Math.max(1, Math.round(durationSec * fps));
      for (let index = 0; index < count; index += 1) frames.push(await player.frameAt(index / fps));
      return { frames, frameSec: 1 / fps };
    } catch (error) {
      for (const frame of frames) frame.close();
      throw error;
    } finally {
      player.dispose();
    }
  }
}
