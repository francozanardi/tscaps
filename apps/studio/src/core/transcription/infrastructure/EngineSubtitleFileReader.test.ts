import { describe, expect, it } from 'vitest';
import { EngineSubtitleFileReader } from '@core/transcription/infrastructure/EngineSubtitleFileReader';
import { SkippedCueBlocksStore } from '@core/transcription/store/SkippedCueBlocksStore';
import { SubtitleFileReadFailedError } from '@core/transcription/domain/errors/SubtitleFileReadFailedError';

const SRT = `1
00:00:01,000 --> 00:00:02,000
Hello there

2
00:00:03,000 --> 00:00:04,000
General Kenobi
`;

// The second cue times each word, which only WebVTT can say.
const VTT = `WEBVTT

00:00:01.000 --> 00:00:02.000
Hello there

00:00:03.000 --> 00:00:05.000
<00:00:03.000>General <00:00:04.500>Kenobi
`;

function texts(words: ReadonlyArray<{ text: string }>): string[] {
  return words.map((word) => word.text);
}

describe('EngineSubtitleFileReader', () => {
  it('reads a SubRip file', async () => {
    const reader = new EngineSubtitleFileReader(new SkippedCueBlocksStore());

    const document = await reader.read({ name: 'talk.srt', text: SRT });

    expect(texts(document.getWords())).toEqual(['Hello', 'there', 'General', 'Kenobi']);
  });

  it('reads a WebVTT file by its header, keeping the word times it carries', async () => {
    const skipped = new SkippedCueBlocksStore();
    const reader = new EngineSubtitleFileReader(skipped);

    const document = await reader.read({ name: 'talk.txt', text: VTT });

    const kenobi = document.getWords().find((word) => word.text === 'Kenobi');
    expect(kenobi?.time.start).toBeCloseTo(4.5);
    expect(skipped.snapshot()).toEqual([]);
  });

  it('records the blocks it could not use, and only those of the last file', async () => {
    const skipped = new SkippedCueBlocksStore();
    const reader = new EngineSubtitleFileReader(skipped);

    await reader.read({ name: 'broken.srt', text: `${SRT}\nstray line without a timecode\n` });
    expect(skipped.snapshot()).toEqual(['stray line without a timecode']);

    await reader.read({ name: 'clean.srt', text: SRT });
    expect(skipped.snapshot()).toEqual([]);
  });

  it('refuses a file with nothing it can use', async () => {
    const reader = new EngineSubtitleFileReader(new SkippedCueBlocksStore());

    await expect(reader.read({ name: 'notes.srt', text: 'just some notes\n\nand more notes' }))
      .rejects.toBeInstanceOf(SubtitleFileReadFailedError);
  });
});
