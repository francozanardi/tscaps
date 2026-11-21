import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditorWithCaptions } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

// six-second-sample.mp4 is a 6s H.264 video with no audio track, regenerated with:
//   ffmpeg -f lavfi -i testsrc=duration=6:size=128x128:rate=10 \
//     -c:v libx264 -preset veryslow -crf 40 -pix_fmt yuv420p -an six-second-sample.mp4
// Long enough for the shots proposed over it to be more than one.
const VIDEO = path.join(FIXTURES, 'six-second-sample.mp4');

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const WORDS_PER_SCENE = 4;
const WORD_SEC = 0.5;
// Shots are proposed on word starts, so every boundary but the video's
// opening sits off the hundredth: a slider stepping from one of them
// would carry it into every value it lands on.
const WORDS_OFFSET_SEC = 0.037;

// Twelve words half a second each, four to a scene, filling the video.
const DOCUMENT = {
  sections: [{
    kind: 'main',
    segments: [0, 1, 2].map((scene) => ({
      lines: [{
        words: WORDS.slice(scene * WORDS_PER_SCENE, (scene + 1) * WORDS_PER_SCENE).map((text, index) => {
          const at = WORDS_OFFSET_SEC + (scene * WORDS_PER_SCENE + index) * WORD_SEC;
          return { text, start: at, end: at + WORD_SEC };
        }),
      }],
    })),
  }],
};

/** Types `sec` as where the shot at `shotIndex` (from zero) ends, and leaves its timing screen. */
async function typeShotEnd(page: Page, shotIndex: number, sec: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit timing' }).nth(shotIndex).click();
  const ends = page.getByLabel('Ends value');
  await ends.fill(sec);
  await ends.press('Enter');
  await expect(ends).toHaveValue(sec);
  await page.keyboard.press('Escape');
}

/** Where the shot numbered `cardNumber` on its card opens, as the playhead reads once the card is pressed. */
async function expectShotOpensAt(page: Page, cardNumber: string, sec: number): Promise<void> {
  await page.getByText(cardNumber, { exact: true }).click();
  // The readout counts milliseconds rounding down, so 1.63 can read 1.629;
  // a boundary a few thousandths off reads past the margin.
  await expect.poll(async () => {
    const readout = (await page.locator('.time-display').textContent()) ?? '';
    const [, minutes, seconds] = /^(\d+):(\d+\.\d+)/.exec(readout) ?? [];
    return Math.abs(Number(minutes) * 60 + Number(seconds) - sec);
  }).toBeLessThan(0.002);
}

test.beforeEach(async ({ page }) => {
  await bootEditorWithCaptions(page, await readFile(VIDEO), DOCUMENT);
  await page.getByRole('tab', { name: 'Video' }).click();
});

test('a shot end typed to the hundredth stays there, and the next shot opens on it', async ({ page }) => {
  await typeShotEnd(page, 0, '1.63');
  await expectShotOpensAt(page, '02', 1.63);
});

test('a shot opening off the hundredth still ends where its end was typed', async ({ page }) => {
  await typeShotEnd(page, 1, '4.21');
  await expectShotOpensAt(page, '03', 4.21);
});
