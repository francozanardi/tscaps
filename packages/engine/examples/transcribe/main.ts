import { RenderPipelineBuilder, type PipelineProgressEvent } from '@tscaps/engine';
import inputVideoUrl from '../input/example.mp4?url';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const statusElement = document.querySelector<HTMLDivElement>('#status')!;

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  try {
    await renderWithDefaultsAndDownload();
  } catch (err) {
    statusElement.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    throw err;
  } finally {
    runButton.disabled = false;
  }
});

async function renderWithDefaultsAndDownload(): Promise<void> {
  setStatus('Fetching input video…');
  const inputBlob = await (await fetch(inputVideoUrl)).blob();

  setStatus('Building pipeline…');
  const pipeline = new RenderPipelineBuilder()
    .withInputVideo(inputBlob)
    .build();

  setStatus('Running pipeline…');
  const result = await pipeline.run((event) => setStatus(describeProgressEvent(event)));

  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, 'output-transcribe.mp4');
  setStatus('Done — download triggered.');
}

function describeProgressEvent(event: PipelineProgressEvent): string {
  switch (event.stage) {
    case 'transcribing':
      if (event.inner.stage === 'loading') {
        return `Downloading Whisper model: ${Math.round(event.inner.progress * 100)}%`;
      }
      return event.inner.progress !== undefined
        ? `Transcribing audio: ${Math.round(event.inner.progress * 100)}%`
        : 'Transcribing audio…';
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
