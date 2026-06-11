import {
  Document,
  Section,
  Segment,
  Line,
  Word,
  TimeFragment,
  PassthroughTranscriber,
  RenderPipelineBuilder,
  type PipelineProgressEvent,
} from '@tscaps/engine';
import inputVideoUrl from '../input/example.mp4?url';

const SECONDS_PER_CHAR = 0.07;
const MIN_WORD_DURATION_SECONDS = 0.18;

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const textArea = document.querySelector<HTMLTextAreaElement>('#text')!;
const statusElement = document.querySelector<HTMLDivElement>('#status')!;

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  try {
    await renderFromTextAndDownload();
  } catch (err) {
    statusElement.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    throw err;
  } finally {
    runButton.disabled = false;
  }
});

async function renderFromTextAndDownload(): Promise<void> {
  setStatus('Fetching input video…');
  const inputBlob = await (await fetch(inputVideoUrl)).blob();

  setStatus('Building document from text…');
  const sourceDocument = buildDocumentFromText(textArea.value);

  setStatus('Building pipeline…');
  const pipeline = new RenderPipelineBuilder()
    .withInputVideo(inputBlob)
    .withTranscriber(new PassthroughTranscriber(sourceDocument))
    .build();

  setStatus('Running pipeline…');
  const result = await pipeline.run((event) => setStatus(describeProgressEvent(event)));

  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, 'output-from-text.mp4');
  setStatus('Done — download triggered.');
}

function buildDocumentFromText(text: string): Document {
  const words: Word[] = [];
  let currentTime = 0;
  for (const wordText of text.split(/\s+/).filter((token) => token.length > 0)) {
    const duration = Math.max(MIN_WORD_DURATION_SECONDS, wordText.length * SECONDS_PER_CHAR);
    words.push(new Word({ text: wordText, time: new TimeFragment(currentTime, currentTime + duration) }));
    currentTime += duration;
  }
  const segment = new Segment({ lines: [new Line({ words })] });
  const section = new Section({ segments: [segment], kind: '' });
  return new Document({ sections: [section] });
}

function describeProgressEvent(event: PipelineProgressEvent): string {
  switch (event.stage) {
    case 'transcribing':
      return 'Transcription bypassed (text input)';
    case 'splitting':
      return event.status === 'started' ? 'Splitting segments and lines…' : 'Splitting done';
    case 'tagging-structural':
      return event.status === 'started' ? 'Tagging structure…' : 'Structure tagging done';
    case 'tagging-semantic':
      return event.status === 'started' ? 'Tagging semantics…' : 'Semantic tagging done';
    case 'applying-effects':
      return event.status === 'started' ? 'Applying effects…' : 'Effects done';
    case 'rendering':
      return `Rendering: ${event.inner.percent}% (frame ${event.inner.currentFrame}/${event.inner.totalFrames})`;
  }
}

function setStatus(text: string): void {
  statusElement.textContent = text;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
