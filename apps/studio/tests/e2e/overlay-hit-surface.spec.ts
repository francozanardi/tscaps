import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditorWithCaptions } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

/**
 * What a press on a caption's empty space reaches. A layout can leave
 * a wide gap between two lines, the way a template that sets one word
 * at the top of the frame and the rest at the bottom leaves the face
 * between them. The gap belongs to the video until the caption is
 * selected; from then on the outline drawn around it is the caption.
 */

const ONE_CAPTION_OF_TWO_LINES = {
  freezeAll: true,
  sections: [{
    kind: 'main',
    segments: [{
      lines: [
        { words: [{ text: 'top', start: 0, end: 0.5 }] },
        { words: [{ text: 'bottom', start: 0.5, end: 1 }] },
      ],
    }],
  }],
};

// Far enough inside the hitzone's 32/22px corona to miss every word, so
// the click selects the segment rather than a word inside it.
const CORONA_CLICK_OFFSET_PX = 6;

// Wider than two coronas, so the line ghosts leave the middle uncovered.
const GAP_PX = 260;

const DRAG_PX = 60;

test('the gap between a caption\'s lines is the video\'s until the caption is selected', async ({ page }) => {
  await bootEditor(page);
  const gap = await gapCentre(page);

  expect(await reachesCaption(page, gap)).toBe(false);

  await selectCaption(page);

  expect(await reachesCaption(page, gap)).toBe(true);
});

test('a selected caption is dragged from the gap inside its outline, and stays selected', async ({ page }) => {
  await bootEditor(page);
  const gap = await gapCentre(page);
  const chrome = await selectCaption(page);
  const topBefore = (await boxOf(chrome)).y;

  await page.mouse.move(gap.x, gap.y);
  await page.mouse.down();
  await page.mouse.move(gap.x, gap.y - DRAG_PX, { steps: 10 });
  await page.mouse.up();

  await expect(chrome).toBeVisible();
  await expect.poll(async () => topBefore - (await boxOf(chrome)).y).toBeGreaterThan(DRAG_PX / 2);
});

async function bootEditor(page: Page): Promise<void> {
  await bootEditorWithCaptions(page, await readFile(path.join(FIXTURES, 'sample.mp4')), ONE_CAPTION_OF_TWO_LINES);
  await page.locator('.subtitle-overlay-scaler .word').first().waitFor();
  await page.addStyleTag({ content: `.subtitle-overlay-scaler .segment > .line + .line { margin-top: ${GAP_PX}px !important; }` });
}

/** The point halfway between the caption's two lines, once the gap has laid out. */
async function gapCentre(page: Page): Promise<{ x: number; y: number }> {
  const lines = page.locator('.subtitle-overlay-scaler .segment[data-tscaps-segment-id] > .line');
  await expect.poll(async () => (await boxOf(lines.nth(1))).y - bottomOf(await boxOf(lines.nth(0)))).toBeGreaterThan(GAP_PX / 2);
  const top = await boxOf(lines.nth(0));
  const bottom = await boxOf(lines.nth(1));
  return { x: top.x + top.width / 2, y: (bottomOf(top) + bottom.y) / 2 };
}

async function selectCaption(page: Page): Promise<Locator> {
  const hitzone = page.locator('.subtitle-overlay-segment-hitzone').first();
  await hitzone.click({ position: { x: CORONA_CLICK_OFFSET_PX, y: CORONA_CLICK_OFFSET_PX } });
  const chrome = page.locator('.subtitle-overlay-segment-chrome.is-selected');
  await expect(chrome).toBeVisible();
  return chrome;
}

/** Whether a press at `point` lands on something that answers for a caption. */
async function reachesCaption(page: Page, point: { x: number; y: number }): Promise<boolean> {
  return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-tscaps-segment-id]') != null, point);
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element is not rendered');
  return box;
}

function bottomOf(box: { y: number; height: number }): number {
  return box.y + box.height;
}
