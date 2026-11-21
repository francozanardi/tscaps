import { describe, expect, it } from 'vitest';
import { CueChangeSegmentSplitter } from '@modules/splitting';
import { SrtTranscriber, VttTranscriber } from '@modules/transcription';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';

const NO_AUDIO = new Blob([]);

const SONG = '1\n00:00:01,000 --> 00:00:03,000\nI walk alone\n\n'
  + '2\n00:00:09,000 --> 00:00:11,000\nunder the rain\n';

/** Every word of the document in one segment, the way the words reach a pipeline that re-cuts them. */
function asOneRun(words: ReadonlyArray<Word>): Segment {
  return new Segment({ lines: [new Line({ words: [...words] })] });
}

function wordsOf(text: string, cueIndexes: ReadonlyArray<number | null>): Word[] {
  return text.split(' ').map((word, i) => new Word({ text: word, time: new TimeFragment(i, i + 1), cueIndex: cueIndexes[i] ?? null }));
}

function textsOf(segments: ReadonlyArray<Segment>): string[] {
  return segments.map((segment) => segment.getText());
}

describe('CueChangeSegmentSplitter', () => {

  it('cuts words read from a SubRip file back into the cues they came from', async () => {
    const document = await new SrtTranscriber(SONG).transcribe(NO_AUDIO);

    const segments = new CueChangeSegmentSplitter(true).split([asOneRun(document.getWords())]);

    expect(textsOf(segments)).toEqual(['I walk alone', 'under the rain']);
    // No segment spans the silence between the cues.
    expect(segments[0]!.time.end).toBeCloseTo(3);
    expect(segments[1]!.time.start).toBeCloseTo(9);
  });

  it('cuts words read from a WebVTT file back into the cues they came from', async () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nI walk alone\n\n00:00:09.000 --> 00:00:11.000\nunder the rain\n';
    const document = await new VttTranscriber(vtt).transcribe(NO_AUDIO);

    const segments = new CueChangeSegmentSplitter(true).split([asOneRun(document.getWords())]);

    expect(textsOf(segments)).toEqual(['I walk alone', 'under the rain']);
  });

  it('leaves words that carry no cue as they were', () => {
    const segment = asOneRun(wordsOf('a transcript without cues', []));

    expect(new CueChangeSegmentSplitter(true).split([segment])).toEqual([segment]);
  });

  it('keeps a word with no cue with the cue around it', () => {
    const segment = asOneRun(wordsOf('one added two three', [0, null, 0, 1]));

    expect(textsOf(new CueChangeSegmentSplitter(true).split([segment]))).toEqual(['one added two', 'three']);
  });

  it('cuts nothing when disabled', async () => {
    const document = await new SrtTranscriber(SONG).transcribe(NO_AUDIO);
    const segment = asOneRun(document.getWords());

    expect(new CueChangeSegmentSplitter(false).split([segment])).toEqual([segment]);
  });
});
