import { describe, expect, it } from 'vitest';
import { Document, Line, RenderTimeMap, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';

/**
 * Where somebody speaks on the output, which is where a clip set to be
 * lowered under speech is lowered: the words, on output time, with the
 * short breaths between them filled so the music does not pump.
 */

const reader = new SpeechSpanReader();
const NO_CUTS = new RenderTimeMap([]);

function documentOf(times: ReadonlyArray<readonly [number, number]>): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: [new Segment({
        lines: [new Line({ words: times.map(([start, end], index) => new Word({ text: `w${index}`, time: new TimeFragment(start, end) })) })],
      })],
    })],
  });
}

describe('SpeechSpanReader', () => {
  it('joins words closer than 0.4 s into one stretch', () => {
    expect(reader.read(documentOf([[1, 1.5], [1.8, 2.2], [2.5, 3]]), NO_CUTS)).toEqual([{ startSec: 1, endSec: 3 }]);
  });

  it('keeps words further apart as stretches of their own', () => {
    expect(reader.read(documentOf([[1, 1.5], [2, 2.2], [5, 6]]), NO_CUTS)).toEqual([
      { startSec: 1, endSec: 1.5 },
      { startSec: 2, endSec: 2.2 },
      { startSec: 5, endSec: 6 },
    ]);
  });

  it('reads the words on output time, so a cut can bring two stretches together', () => {
    const cut = new RenderTimeMap([{ startSec: 2, endSec: 4.75 }]);

    expect(reader.read(documentOf([[1, 2], [5, 6]]), cut)).toEqual([{ startSec: 1, endSec: 3.25 }]);
  });

  it('leaves out a word that is cut away', () => {
    const cut = new RenderTimeMap([{ startSec: 3, endSec: 4 }]);

    expect(reader.read(documentOf([[1, 2], [3, 4]]), cut)).toEqual([{ startSec: 1, endSec: 2 }]);
  });

  it('holds no speech where there is no transcript', () => {
    expect(reader.read(null, NO_CUTS)).toEqual([]);
  });
});
