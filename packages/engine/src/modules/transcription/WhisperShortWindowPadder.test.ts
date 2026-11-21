import { describe, expect, it } from 'vitest';
import {
  WhisperShortWindowPadder,
  type WindowFeatureExtractor,
  type WindowFeatures,
} from '@modules/transcription/WhisperShortWindowPadder';

const BANDS = 2;
const FRAMES = 10;
const HOP_LENGTH = 4;
/** What the extraction below writes in every frame, audio or not. */
const EXTRACTED = -0.75;

/** An extractor that, like the library's, fills the whole window whatever the audio's length. */
function extractorFillingTheWindow(): WindowFeatureExtractor {
  return {
    config: { hop_length: HOP_LENGTH },
    _call: async (): Promise<WindowFeatures> => ({
      input_features: {
        dims: [1, BANDS, FRAMES],
        data: new Float32Array(BANDS * FRAMES).fill(EXTRACTED),
      },
    }),
  };
}

async function featuresOf(extractor: WindowFeatureExtractor, audioSamples: number): Promise<number[][]> {
  const { data } = (await extractor._call(new Float32Array(audioSamples))).input_features;
  return Array.from({ length: BANDS }, (_, band) => [...data.subarray(band * FRAMES, (band + 1) * FRAMES)]);
}

describe('WhisperShortWindowPadder', () => {
  it('leaves at zero the frames past the end of the audio, in every band', async () => {
    const extractor = extractorFillingTheWindow();
    new WhisperShortWindowPadder().install(extractor);

    // 24 samples at 4 per frame: the audio covers frames 0-5.
    const bands = await featuresOf(extractor, 24);

    for (const band of bands) expect(band.slice(6)).toEqual([0, 0, 0, 0]);
  });

  it('keeps the frames the audio covers as they were extracted', async () => {
    const extractor = extractorFillingTheWindow();
    new WhisperShortWindowPadder().install(extractor);

    const bands = await featuresOf(extractor, 24);

    for (const band of bands) expect(band.slice(0, 6)).toEqual(Array(6).fill(EXTRACTED));
  });

  it('changes nothing in a window the audio fills', async () => {
    const extractor = extractorFillingTheWindow();
    new WhisperShortWindowPadder().install(extractor);

    const bands = await featuresOf(extractor, FRAMES * HOP_LENGTH);

    for (const band of bands) expect(band).toEqual(Array(FRAMES).fill(EXTRACTED));
  });

  it('changes nothing in a window of audio longer than the window', async () => {
    const extractor = extractorFillingTheWindow();
    new WhisperShortWindowPadder().install(extractor);

    const bands = await featuresOf(extractor, FRAMES * HOP_LENGTH * 3);

    for (const band of bands) expect(band).toEqual(Array(FRAMES).fill(EXTRACTED));
  });

  it('leaves a window with no audio at all entirely at zero', async () => {
    const extractor = extractorFillingTheWindow();
    new WhisperShortWindowPadder().install(extractor);

    const bands = await featuresOf(extractor, 0);

    for (const band of bands) expect(band).toEqual(Array(FRAMES).fill(0));
  });
});
