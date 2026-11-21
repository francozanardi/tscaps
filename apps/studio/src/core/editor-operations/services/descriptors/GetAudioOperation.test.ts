import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import { EditorStore } from '@core/editor/store/EditorStore';
import { AudioLevelsReader } from '@core/editor-operations/services/AudioLevelsReader';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { GetAudioOperation } from '@core/editor-operations/services/descriptors/GetAudioOperation';

/** Hands back the same envelope for any file. */
class FixedWaveform implements WaveformExtractor {
  constructor(private readonly peaks: Float32Array) {}

  async extract(): Promise<Float32Array> {
    return this.peaks;
  }
}

/** 4 s of sound at 100 peaks a second: a word from 1 s to 2 s, near silence around it. */
function setUp(withFile = true) {
  const store = new EditorStore();
  const said = new Word({ text: 'hello', time: new TimeFragment(0.9, 1.8) });
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ id: 's0', lines: [new Line({ words: [said] })] })] })] }),
    video: { ...store.snapshot().video, duration: 4, file: withFile ? new File([], 'video.mp4') : null },
  });
  const peaks = Float32Array.from({ length: 400 }, (_, index) => (index >= 100 && index < 200 ? 0.5 : 0.001));
  const operation = new GetAudioOperation(store, new AudioLevelsReader(store, new FixedWaveform(peaks)), new EditorRefParser(), new ReadoutFormatter());
  return { operation, said };
}

describe('get_audio', () => {
  it('answers the level as digits, where it is quiet, and the words over the stretch', async () => {
    const { operation, said } = setUp();

    const result = await operation.run({ fromSec: 0.5, toSec: 2.5 });

    expect(result.ok).toBe(true);
    const output = result.output as { binSec: number; levels: string; quiet: number[][]; words: unknown[] };
    expect(output.binSec).toBe(0.05);
    expect(output.levels).toBe(`${'0'.repeat(10)}${'9'.repeat(20)}${'0'.repeat(10)}`);
    expect(output.quiet).toEqual([[0, 1], [2, 4]]);
    expect(output.words).toEqual([[`word:${said.id}`, 'hello', 0.9, 1.8]]);
  });

  it('refuses while the video file is not loaded', async () => {
    const result = await setUp(false).operation.run({ fromSec: 0, toSec: 2 });

    expect(result.ok).toBe(false);
  });
});
