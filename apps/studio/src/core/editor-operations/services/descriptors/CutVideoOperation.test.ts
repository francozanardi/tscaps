import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { AddCutAction } from '@core/cuts/actions/AddCutAction';
import { RemoveSilencesAction } from '@core/cuts/actions/RemoveSilencesAction';
import { RestoreCutsRangeAction } from '@core/cuts/actions/RestoreCutsRangeAction';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { CutCompactor } from '@core/cuts/services/CutCompactor';
import { SilenceFinder } from '@core/cuts/services/SilenceFinder';
import { SilencePadder } from '@core/cuts/services/SilencePadder';
import { EditorStore } from '@core/editor/store/EditorStore';
import { CutVideoOperation } from '@core/editor-operations/services/descriptors/CutVideoOperation';
import type { WaveformExtractor } from '@core/audio/domain/WaveformExtractor';
import { AudioLevelsReader } from '@core/editor-operations/services/AudioLevelsReader';
import { SilenceSoundTrimmer } from '@core/editor-operations/services/SilenceSoundTrimmer';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/**
 * Cuts asked for by a program, in seconds of the source video: brought
 * back first, then cut, then the pauses the preset finds; none of it
 * where a stretch is out of the video or nothing would be left to play.
 */

/** Sends nothing anywhere: what is sent is not what these tests are about. */
class SilentTelemetry implements Telemetry {
  capture(): void {}
}

/** Hands back the same envelope for any file: the sound these tests describe. */
class FixedWaveform implements WaveformExtractor {
  constructor(private readonly peaks: Float32Array) {}

  async extract(): Promise<Float32Array> {
    return this.peaks;
  }
}

/** 10 s at 100 peaks a second: loud over each stretch given, near silent elsewhere. */
function soundOver(...loud: Array<[number, number]>): Float32Array {
  return Float32Array.from({ length: 1000 }, (_, index) => (loud.some(([from, to]) => index >= from * 100 && index < to * 100) ? 0.5 : 0.001));
}

const word = (text: string, startSec: number, endSec: number) => new Word({ text, time: new TimeFragment(startSec, endSec) });

/** A 10 s video: "hi" at 0.5 s, then a pause until "there you" at 4 s, then silence to the end; or `words` in one caption. */
function setUp(cuts: CutRegistry = CutRegistry.empty(), sound: Float32Array | null = null, words: Word[] | null = null) {
  const store = new EditorStore();
  const segments = words === null
    ? [
      new Segment({ id: 's0', lines: [new Line({ words: [word('hi.', 0.5, 1.5)] })] }),
      new Segment({ id: 's1', lines: [new Line({ words: [word('there', 4, 5), word('you.', 5.1, 6)] })] }),
    ]
    : [new Segment({ id: 's0', lines: [new Line({ words })] })];
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
    video: { ...store.snapshot().video, duration: 10, file: sound === null ? null : new File([], 'video.mp4') },
    cuts,
  });
  const operation = new CutVideoOperation(
    store,
    new CaptionRefResolver(store, new EditorRefParser()),
    new OriginalCaptionTrackReader(),
    new SilenceFinder(new SilencePadder()),
    new AddCutAction(store),
    new RestoreCutsRangeAction(store),
    new RemoveSilencesAction(store, new CutCompactor(), new SilentTelemetry()),
    new AudioLevelsReader(store, new FixedWaveform(sound ?? new Float32Array())),
    new SilenceSoundTrimmer(),
  );
  return { store, operation };
}

function cutsOf(store: EditorStore): Array<[number, number]> {
  return store.snapshot().cuts.list().map((range) => [range.startSec, range.endSec]);
}

describe('cut_video', () => {
  it('cuts words by ref with the quiet around them, up to the neighbouring words less a little air', async () => {
    const { store, operation } = setUp();
    const [hi, , you] = store.snapshot().document!.getWords();

    const result = await operation.run({ cutWords: [`word:${you!.id}`, `word:${hi!.id}`] });

    expect(result.ok).toBe(true);
    // "hi." takes the lead-in and the pause up to "there" (less 0.15 s of air); "you." the pause before it and the tail.
    const [first, last] = cutsOf(store);
    expect(first![0]).toBeCloseTo(0);
    expect(first![1]).toBeCloseTo(3.85);
    expect(last![0]).toBeCloseTo(5.02);
    expect(last![1]).toBeCloseTo(10);
  });

  it('cuts a word timed as an instant, a cut-off "a-", with the quiet around it', async () => {
    const instant = word('a-', 2.5, 2.5);
    const { store, operation } = setUp(CutRegistry.empty(), null, [word('hi.', 0.5, 1.5), instant, word('there', 4, 5)]);

    const result = await operation.run({ cutWords: [`word:${instant.id}`] });

    expect(result.ok).toBe(true);
    expect(result.problems.filter((problem) => problem.severity === 'error')).toEqual([]);
    const [cut] = cutsOf(store);
    expect(cut![0]).toBeLessThan(2.5);
    expect(cut![1]).toBeGreaterThan(2.5);
  });

  it('brings stretches back, then cuts, and answers the cuts in place and what is left to play', async () => {
    const { store, operation } = setUp(CutRegistry.empty().add({ startSec: 2, endSec: 6 }));

    const result = await operation.run({ restore: [{ startSec: 3, endSec: 4 }], cut: [{ startSec: 8, endSec: 30 }] });

    expect(cutsOf(store)).toEqual([[2, 3], [4, 6], [8, 10]]);
    expect(result.output).toEqual({ cuts: [[2, 3], [4, 6], [8, 10]], removedSec: 5, remainingSec: 5 });
  });

  it('removes the pauses the preset finds, leaving out those a cut already holds', async () => {
    const { store, operation } = setUp(CutRegistry.empty().add({ startSec: 1.5, endSec: 4 }));

    const result = await operation.run({ removeSilences: 'natural' });

    expect(cutsOf(store)).toEqual([[1.5, 4], [6.15, 10]]);
    expect(result.output).toMatchObject({ pauses: { cut: 1 }, removedSec: 6.35, remainingSec: 3.65 });
  });

  it.each([
    ['cuts that would leave nothing to play', { cut: [{ startSec: 0, endSec: 10 }] }, /whole video/],
    ['a stretch that ends before it starts', { cut: [{ startSec: 4, endSec: 3 }] }, /cut\.0: endSec must be after startSec/],
    ['a stretch past the video\'s end', { restore: [{ startSec: 12, endSec: 14 }] }, /restore\.0: starts at or past the video's end/],
    ['nothing to do', {}, /Give cut, cutWords, restore or removeSilences/],
    ['a preset there is not', { removeSilences: 'fastest' }, /removeSilences/],
  ])('refuses %s, changing nothing', async (_, input, message) => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run(input);

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toMatch(message);
    expect(store.snapshot()).toBe(before);
  });

  it('keeps the pace\'s air from where a word\'s sound really ends, the transcript ending it early', async () => {
    // The transcript ends "hi." at 1.5 s; the sound of it runs to 1.7 s. Fast keeps 0.18 s after a sentence, 0.12 s before one.
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1.7], [4, 6]));

    const result = await operation.run({ removeSilences: 'fast' });

    expect(result.output).toMatchObject({ pauses: { cut: 2, madeSmallerBySound: 2 } });
    const [first, last] = cutsOf(store);
    expect(first![0]).toBeCloseTo(1.88);
    expect(first![1]).toBeCloseTo(3.85);
    expect(last![0]).toBeCloseTo(6.18);
    expect(last![1]).toBeCloseTo(10);
  });

  it('leaves more pause between sentences than inside one, measured from the words\' sound', async () => {
    const between = setUp(CutRegistry.empty(), soundOver([0.5, 1.5], [4, 6]));
    const within = setUp(CutRegistry.empty(), soundOver([0.5, 1], [2, 2.5]), [word('so', 0.5, 1), word('then', 2, 2.5)]);

    await between.operation.run({ removeSilences: 'natural' });
    await within.operation.run({ removeSilences: 'natural' });

    // Between "hi." and "there": 0.27 s after the one, 0.18 s before the other.
    const [sentenceBreak] = cutsOf(between.store);
    expect(sentenceBreak![0]).toBeCloseTo(1.77);
    expect(sentenceBreak![1]).toBeCloseTo(3.82);
    // Between "so" and "then": 0.18 s after "so"; before "then", the word gap's own padding is more than 0.12 s.
    const [hesitation] = cutsOf(within.store);
    expect(hesitation![0]).toBeCloseTo(1.18);
    expect(hesitation![1]).toBeCloseTo(1.85);
  });

  it('does not cut a pause the air leaves too little of to be worth the jump', async () => {
    // A 0.6 s pause inside a sentence, with "so" sounding 0.1 s past its time: natural would take out only 0.2 s.
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1.1], [1.6, 2]), [word('so', 0.5, 1), word('then', 1.6, 2)]);

    const result = await operation.run({ removeSilences: 'natural' });

    expect(result.output).toMatchObject({ pauses: { cut: 1, left: 1 } });
    expect(cutsOf(store).every(([startSec]) => startSec >= 2)).toBe(true);
  });

  it('never makes a pause larger than the words leave, however much quiet the sound has', async () => {
    // Quiet from 1.2 s on, though the transcript says "hi." runs to 1.5 s.
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1.2], [4, 6]));

    await operation.run({ removeSilences: 'fast' });

    expect(cutsOf(store)[0]![0]).toBeCloseTo(1.65);
  });

  it('removes no pause where steady sound runs under the voice, which would jump at every cut, and says why', async () => {
    const steady = soundOver([0.5, 1.7], [4, 6]).map((peak) => Math.max(peak, 0.1));
    const { store, operation } = setUp(CutRegistry.empty(), steady);
    const before = store.snapshot();

    const result = await operation.run({ removeSilences: 'fast' });

    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([expect.objectContaining({ message: expect.stringMatching(/jump.*overSteadySound/) })]);
    expect(store.snapshot()).toBe(before);
  });

  it('removes the pauses over steady sound when asked to, with a wider margin from the words', async () => {
    const steady = soundOver([0.5, 1.7], [4, 6]).map((peak) => Math.max(peak, 0.1));
    const { store, operation } = setUp(CutRegistry.empty(), steady);

    const result = await operation.run({ removeSilences: 'fast', overSteadySound: true });

    expect(result.output).toMatchObject({ pauses: { cutWithWiderMargin: 2 } });
    expect(cutsOf(store)[0]![0]).toBeCloseTo(1.8);
    expect(result.problems).toEqual([expect.objectContaining({ message: expect.stringContaining('music or noise') })]);
  });

  it('leaves a pause that sound runs all through, which no word was transcribed for, and cuts the quiet ones', async () => {
    // Music (or a voice the transcription missed) fills the gap between "hi." and "there"; the end is quiet.
    const filled = soundOver([0.5, 1.5], [4, 6]).map((peak, index) => (index >= 150 && index < 400 ? 0.05 : peak));
    const { store, operation } = setUp(CutRegistry.empty(), filled);

    const result = await operation.run({ removeSilences: 'fast' });

    expect(result.output).toMatchObject({ pauses: { cut: 1, leftWithSound: 1 } });
    expect(cutsOf(store).every(([startSec]) => startSec >= 6)).toBe(true);
    expect(result.problems).toEqual([expect.objectContaining({ message: expect.stringContaining('not silence') })]);
  });

  it('moves a word cut\'s edge off the sound of the word before, which runs past its time', async () => {
    // "there" sounds until 5.2 s, though the transcript ends it at 5 s and starts "you." at 5.1 s.
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1.7], [4, 5.2], [5.25, 6]));
    const you = store.snapshot().document!.getWords()[2]!;

    const result = await operation.run({ cutWords: [`word:${you.id}`] });

    expect(result.output).toMatchObject({ words: { cut: 1, madeSmallerBySound: 1, left: 0 } });
    const [[startSec, endSec]] = cutsOf(store) as [[number, number]];
    expect(startSec).toBeCloseTo(5.23);
    expect(endSec).toBeCloseTo(10);
  });

  it('cuts a filler with all of its sound, keeping the pace\'s air from the words around it', async () => {
    const um = word('um', 1.5, 1.8);
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1], [1.5, 1.8], [2.5, 3]), [word('so', 0.5, 1), um, word('yes', 2.5, 3)]);

    const result = await operation.run({ cutWords: [`word:${um.id}`] });

    expect(result.output).toMatchObject({ words: { cut: 1, left: 0, keptAsAir: 0 } });
    // 0.18 s after "so" stops sounding; before "yes", the word gap's own padding is more than 0.12 s.
    const [[startSec, endSec]] = cutsOf(store) as [[number, number]];
    expect(startSec).toBeCloseTo(1.18);
    expect(endSec).toBeCloseTo(2.36);
  });

  it('keeps a filler whose cut would press the words around it together, and says which', async () => {
    const uh = word('uh', 1.05, 1.25);
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1], [1.05, 1.25], [1.3, 1.8]), [word('so', 0.5, 1), uh, word('yes', 1.3, 1.8)]);

    const result = await operation.run({ cutWords: [`word:${uh.id}`] });

    expect(cutsOf(store)).toEqual([]);
    expect(result.output).toMatchObject({ words: { cut: 0, left: 0, keptAsAir: 1 } });
    expect(result.problems).toEqual([expect.objectContaining({ message: expect.stringMatching(/pressed together: "uh" \(1\.05 s\)/) })]);
  });

  it('leaves words whose sound runs into a neighbour with no quiet between, and says which', async () => {
    const { store, operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1.7], [4, 6]));
    const you = store.snapshot().document!.getWords()[2]!;

    const result = await operation.run({ cutWords: [`word:${you.id}`] });

    expect(cutsOf(store)).toEqual([]);
    expect(result.output).toMatchObject({ words: { cut: 0, left: 1 } });
    expect(result.problems).toEqual([expect.objectContaining({ message: expect.stringContaining('"you." (5.1 s)') })]);
  });

  it('warns when a cut edge falls in sound, which is likely the middle of a word', async () => {
    const { operation } = setUp(CutRegistry.empty(), soundOver([0.5, 1.7], [4, 6]));

    const result = await operation.run({ cut: [{ startSec: 1, endSec: 2.5 }] });

    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('1 s, likely a word') })]);
  });

  it('falls back to the word times when the sound cannot be read, and says so', async () => {
    const { operation } = setUp();

    const result = await operation.run({ removeSilences: 'fast' });

    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('word times') })]);
  });
});
