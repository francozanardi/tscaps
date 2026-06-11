import {
  RenderPipelineBuilder,
  SrtTranscriber,
  LimitByWordsSegmentSplitter,
} from '@tscaps/engine';
import inputVideoUrl from '../input/example.mp4?url';

const DEMO_SRT = `1
00:00:00,500 --> 00:00:02,500
Welcome to the engine.

2
00:00:02,500 --> 00:00:05,500
Captions burned in the browser.

3
00:00:05,500 --> 00:00:08,000
No server, no editor.
`;

const CUSTOM_CAPTION_CSS = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 800;
    font-size: 6cqh;
    color: #ffd400;
    -webkit-text-stroke: 0.06em #000;
    paint-order: stroke fill;
    text-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.6);
    text-align: center;
    line-height: 1.2;
  }
  .line { display: block; text-align: center; }
  .word { display: inline-block; margin: 0 0.15em; }
`;

const KARAOKE_CAPTION_CSS = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 800;
    font-size: 6cqh;
    -webkit-text-stroke: 0.06em #000;
    paint-order: stroke fill;
    text-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.6);
    text-align: center;
    line-height: 1.2;
  }
  .line { display: block; text-align: center; }
  .word {
    display: inline-block;
    margin: 0 0.15em;
    color: #ffffff;
  }
  .word.word-being-narrated { color: #ffd400; }
  .word.word-already-narrated { color: #b0b0b0; }
`;

const SINGLE_WORD_CAPTION_CSS = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 900;
    font-size: 11cqh;
    color: #ffffff;
    -webkit-text-stroke: 0.05em #000;
    paint-order: stroke fill;
    text-shadow: 0 0.12em 0.3em rgba(0, 0, 0, 0.6);
    text-align: center;
    line-height: 1.1;
    letter-spacing: 0.02em;
  }
  .line { display: block; text-align: center; }
  .word { display: inline-block; }
`;

const SLIDE_IN_CAPTION_CSS = `
  @keyframes segment-slide-in {
    from { transform: translateY(0.5em); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 800;
    font-size: 6cqh;
    text-align: center;
    line-height: 1.2;
    padding: 0.2em 0.6em;
    border-radius: 0.25em;
    background: rgba(255, 212, 0, 0.92);
    color: #111;
    animation: segment-slide-in 0.35s var(--on-segment-starts) ease-out both;
  }
  .line { display: block; text-align: center; }
  .word { display: inline-block; margin: 0 0.1em; }
`;

declare global {
  interface Window {
    renderFromSrtVariant(): Promise<void>;
    renderCustomCssVariant(): Promise<void>;
    renderCssAlignmentVariant(): Promise<void>;
    renderKaraokeVariant(): Promise<void>;
    renderSlideInVariant(): Promise<void>;
    renderSingleWordVariant(): Promise<void>;
  }
}

window.renderFromSrtVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob()),
    'readme-from-srt.mp4',
  );
};

window.renderCustomCssVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob()).withCss(CUSTOM_CAPTION_CSS),
    'readme-custom-css.mp4',
  );
};

window.renderCssAlignmentVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob())
      .withCss(CUSTOM_CAPTION_CSS)
      .withAlignment({
        verticalAlign: 'top',
        verticalOffset: 0.12,
        horizontalAlign: 'center',
        horizontalOffset: 0.5,
      }),
    'readme-css-alignment.mp4',
  );
};

window.renderKaraokeVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob()).withCss(KARAOKE_CAPTION_CSS),
    'readme-karaoke.mp4',
  );
};

window.renderSlideInVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob()).withCss(SLIDE_IN_CAPTION_CSS),
    'readme-slide-in.mp4',
  );
};

window.renderSingleWordVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob())
      .withSegmentSplitter(new LimitByWordsSegmentSplitter({ maxWords: 1 }))
      .withDefaultLineSplitterConfig({ maxLines: 1 })
      .withCss(SINGLE_WORD_CAPTION_CSS),
    'readme-single-word.mp4',
  );
};

function buildBaseBuilder(inputVideo: Blob): RenderPipelineBuilder {
  return new RenderPipelineBuilder()
    .withInputVideo(inputVideo)
    .withTranscriber(new SrtTranscriber(DEMO_SRT));
}

async function fetchInputBlob(): Promise<Blob> {
  return (await fetch(inputVideoUrl)).blob();
}

async function renderAndTriggerDownload(builder: RenderPipelineBuilder, filename: string): Promise<void> {
  const pipeline = builder.build();
  const result = await pipeline.run((event) => console.log(JSON.stringify(event)));
  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, filename);
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
