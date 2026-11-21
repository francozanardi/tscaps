import {
  Document,
  LimitByWordsSegmentSplitter,
  MediaBunnyRenderers,
  RenderPipelineBuilder,
  SrtTranscriber,
  type RenderAudioMix,
  type RenderFootage,
} from '@tscaps/engine';
import inputVideoUrl from '../input/example.mp4?url';
import brollVideoUrl from '../input/broll.mp4?url';

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

// Fades in over 0.3 s from where the layer starts, zooms in slowly while
// it shows, and fades out over the last 0.3 s before it ends.
const BROLL_CSS = `
  @keyframes broll-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes broll-fade-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes broll-zoom { from { scale: 1; } to { scale: 1.1; } }
  [data-tscaps-el="broll"] {
    animation:
      broll-fade-in 0.3s var(--on-layer-starts) both,
      broll-zoom 2s var(--on-layer-starts) linear both,
      broll-fade-out 0.3s calc(var(--on-layer-ends) - 0.3s) forwards;
  }
`;

// The b-roll fills the frame, and the speaker comes into a rounded box in
// the top-right corner, growing from that corner.
const PICTURE_IN_PICTURE_CSS = `
  @keyframes speaker-in { from { scale: 0.4; opacity: 0; } to { scale: 1; opacity: 1; } }
  [data-tscaps-el="speaker"] {
    left: 52%;
    top: 4%;
    width: 44%;
    height: 34%;
    border-radius: 4cqmin;
    object-fit: cover;
    object-position: 50% 15%;
    transform-origin: 100% 0%;
    animation: speaker-in 0.4s var(--on-layer-starts) ease-out both;
  }
`;

// The speaker in the top half, the b-roll in the bottom half.
const SPLIT_SCREEN_CSS = `
  [data-tscaps-el="speaker"] {
    height: 50%;
    object-fit: cover;
    object-position: 50% 20%;
  }
  [data-tscaps-el="broll"] {
    top: 50%;
    height: 50%;
    object-fit: cover;
  }
`;

// Shows the top of the portrait video, where the face is, and closes in
// on it slowly over the whole clip.
const PUSH_IN_CSS = `
  @keyframes push-in { from { scale: 1; } to { scale: 1.2; } }
  [data-tscaps-el="camera"] {
    object-position: 50% 20%;
    transform-origin: 50% 35%;
    animation: push-in 8s var(--on-layer-starts) linear both;
  }
`;

declare global {
  interface Window {
    renderBrollVariant(): Promise<void>;
    renderPictureInPictureVariant(): Promise<void>;
    renderSplitScreenVariant(): Promise<void>;
    renderSquarePushInVariant(): Promise<void>;
    renderMusicAndCutVariant(): Promise<void>;
    renderWithoutCaptionsVariant(): Promise<void>;
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

window.renderBrollVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob()).withCss(CUSTOM_CAPTION_CSS).withFootage(brollFootage(await fetchBrollBlob())),
    'readme-broll.mp4',
  );
};

window.renderPictureInPictureVariant = async () => {
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob()).withCss(CUSTOM_CAPTION_CSS).withFootage(pictureInPictureFootage(await fetchBrollBlob())),
    'readme-picture-in-picture.mp4',
  );
};

window.renderSplitScreenVariant = async () => {
  const broll = await fetchBrollBlob();
  const footage: RenderFootage = {
    layers: [
      { id: 'broll', source: { kind: 'video', blob: broll }, outputStartSec: 5.5, outputEndSec: 8, sourceStartSec: 1, sourcePassSec: Infinity },
      { id: 'speaker', source: { kind: 'source-picture' }, outputStartSec: 5.5, outputEndSec: 8, sourceStartSec: 0, sourcePassSec: Infinity },
    ],
    style: { css: SPLIT_SCREEN_CSS, frameWidth: 720, frameHeight: 1280 },
  };
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob())
      .withCss(CUSTOM_CAPTION_CSS)
      .withAlignment({ verticalAlign: 'center', verticalOffset: 0.5, horizontalAlign: 'center', horizontalOffset: 0.5 })
      .withFootage(footage),
    'readme-split-screen.mp4',
  );
};

/** The b-roll, from its 1 s mark, over the stretch where the speaker talks to the camera. */
function brollFootage(broll: Blob): RenderFootage {
  return {
    layers: [{ id: 'broll', source: { kind: 'video', blob: broll }, outputStartSec: 5.5, outputEndSec: 7.5, sourceStartSec: 1, sourcePassSec: Infinity }],
    style: { css: BROLL_CSS, frameWidth: 720, frameHeight: 1280 },
  };
}

/** The b-roll fills the frame from 5.5 s, and the speaker comes into a box in the corner. */
function pictureInPictureFootage(broll: Blob): RenderFootage {
  return {
    layers: [
      { id: 'broll', source: { kind: 'video', blob: broll }, outputStartSec: 5.5, outputEndSec: 8, sourceStartSec: 1, sourcePassSec: Infinity },
      { id: 'speaker', source: { kind: 'source-picture' }, outputStartSec: 5.5, outputEndSec: 8, sourceStartSec: 0, sourcePassSec: Infinity },
    ],
    style: { css: PICTURE_IN_PICTURE_CSS, frameWidth: 720, frameHeight: 1280 },
  };
}

window.renderSquarePushInVariant = async () => {
  const footage: RenderFootage = {
    layers: [{
      id: 'camera',
      source: { kind: 'source-picture' },
      outputStartSec: 0,
      outputEndSec: 8,
      sourceStartSec: 0,
      sourcePassSec: Infinity,
    }],
    style: { css: PUSH_IN_CSS, frameWidth: 720, frameHeight: 720 },
    grade: { exposure: 0.05, contrast: 0.25, saturation: -0.2, temperature: 0.35, tint: 0, vignette: 0.5 },
  };
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob())
      .withCss(CUSTOM_CAPTION_CSS)
      .withFrame(720, 720)
      .withFootage(footage),
    'readme-square-push-in.mp4',
  );
};

window.renderMusicAndCutVariant = async () => {
  const music = await synthesizeMusic(10);
  const audioMix: RenderAudioMix = {
    layers: [{
      id: 'music',
      source: music,
      outputStartSec: 0,
      outputEndSec: Infinity,
      sourceStartSec: 0,
      sourcePassSec: Infinity,
      gain: 0.3,
      fadeInSec: 1,
      fadeOutSec: 1.5,
      duck: {
        ranges: [{ startSec: 0.5, endSec: 7.3 }],
        gain: 0.4,
        attackSec: 0.2,
        releaseSec: 0.5,
      },
    }],
    inputGain: 1,
  };
  await renderAndTriggerDownload(
    buildBaseBuilder(await fetchInputBlob())
      .withCss(CUSTOM_CAPTION_CSS)
      .withSkipRanges([{ startSec: 2.5, endSec: 3.2 }])
      .withAudioMix(audioMix),
    'readme-music-and-cut.mp4',
  );
};

window.renderWithoutCaptionsVariant = async () => {
  const video = await fetchInputBlob();
  const renderers = new MediaBunnyRenderers();
  const job = {
    video,
    document: new Document({ sections: [] }),
    styles: {},
    footage: pictureInPictureFootage(await fetchBrollBlob()),
  };
  const session = await renderers.stillFrameRenderer.open(job);
  try {
    const { bitmap } = await session.frameAt(6.5);
    triggerBrowserDownload(await bitmapToPng(bitmap), 'readme-still-at-6.5s.png');
    bitmap.close();
  } finally {
    await session.close();
  }
  const { blob } = await renderers.videoRenderer.render(job);
  if (blob === null) throw new Error('Renderer returned no blob');
  triggerBrowserDownload(blob, 'readme-without-captions.mp4');
};

/** A few seconds of soft chords as a WAV file, standing in for a music track. */
async function synthesizeMusic(seconds: number): Promise<Blob> {
  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, seconds * sampleRate, sampleRate);
  const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]];
  chords.forEach((chord, index) => {
    for (const frequency of chord) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      const start = index * (seconds / chords.length);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.1);
      gain.gain.linearRampToValueAtTime(0, start + seconds / chords.length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds / chords.length);
    }
  });
  return encodeWav(await context.startRendering());
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) bytes.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  bytes.setUint32(4, 36 + frames * channels * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, channels, true);
  bytes.setUint32(24, buffer.sampleRate, true);
  bytes.setUint32(28, buffer.sampleRate * channels * 2, true);
  bytes.setUint16(32, channels * 2, true);
  bytes.setUint16(34, 16, true);
  writeText(36, 'data');
  bytes.setUint32(40, frames * channels * 2, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame]!));
      bytes.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

async function bitmapToPng(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

function buildBaseBuilder(inputVideo: Blob): RenderPipelineBuilder {
  return new RenderPipelineBuilder()
    .withInputVideo(inputVideo)
    .withTranscriber(new SrtTranscriber(DEMO_SRT));
}

async function fetchInputBlob(): Promise<Blob> {
  return (await fetch(inputVideoUrl)).blob();
}

async function fetchBrollBlob(): Promise<Blob> {
  return (await fetch(brollVideoUrl)).blob();
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
