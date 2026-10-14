import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditorWithCaptions } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

/**
 * A word painted apart — blended with the video, or hidden behind the
 * person — is painted by a copy of its segment laid over the original,
 * and hidden in the original. What the user sees is the copy, so the
 * copy is what has to answer the pointer and travel with a drag.
 */

const CENTER_TOLERANCE_PX = 2;

test('a blended word can still be picked', async ({ page }) => {
  await bootEditor(page);
  const wordId = await blendFirstWord(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('.subtitle-overlay-word-selection')).toBeHidden();

  const copyWord = copyWordOf(page, wordId);
  await copyWord.click();
  await expect(page.locator('.subtitle-overlay-word-selection')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Element properties' })).toBeVisible();
});

test('a blended word travels with its segment while it is dragged', async ({ page }) => {
  await bootEditor(page);
  const wordId = await blendFirstWord(page);
  await page.keyboard.press('Escape');

  const original = page.locator(`.segment[data-tscaps-segment-id] [data-tscaps-word-id="${wordId}"]`);
  const copyWord = copyWordOf(page, wordId);
  const before = await centreOf(copyWord);

  // The corona of the hitzone, away from every word, so the press moves
  // the caption rather than picking a word inside it.
  const hitzone = page.locator('.subtitle-overlay-segment-hitzone').first();
  const box = (await hitzone.boundingBox())!;
  await page.mouse.move(box.x + 6, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + 6, box.y + 6 - 60, { steps: 8 });

  await expect.poll(async () => before.y - (await centreOf(copyWord)).y).toBeGreaterThan(30);
  const [copyCentre, originalCentre] = [await centreOf(copyWord), await centreOf(original)];
  expect(Math.abs(copyCentre.x - originalCentre.x)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(Math.abs(copyCentre.y - originalCentre.y)).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

  await page.mouse.up();
});

async function bootEditor(page: Page): Promise<void> {
  await bootEditorWithCaptions(
    page,
    await readFile(path.join(FIXTURES, 'sample.mp4')),
    JSON.parse(await readFile(path.join(FIXTURES, 'document.json'), 'utf8')),
  );
  await page.locator('.subtitle-overlay-scaler .word').first().waitFor();
}

/** Blends the first word of the caption on screen from the Effects tab, and returns its id. */
async function blendFirstWord(page: Page): Promise<string> {
  const word = page.locator('.subtitle-overlay-scaler .segment').first().locator('.word').first();
  const wordId = (await word.getAttribute('data-tscaps-word-id'))!;
  await word.click();
  await page.getByRole('tab', { name: 'Effects' }).click();
  await page.getByRole('switch').first().click();
  await expect(copyWordOf(page, wordId)).toBeAttached();
  return wordId;
}

/** The word as the copy paints it, which is the one the user sees. */
function copyWordOf(page: Page, wordId: string) {
  return page.locator(`.subtitle-overlay-wrapper[aria-hidden="true"] [data-tscaps-word-id="${wordId}"]`);
}

async function centreOf(locator: ReturnType<Page['locator']>): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element is not rendered');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
