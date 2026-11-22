import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditor, setVideoBytes } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('separate transcription audio can be selected, removed and selected again', async ({ page }) => {
  await bootEditor(page);
  await setVideoBytes(page, await readFile(path.join(__dirname, 'fixtures/no-audio-sample.mp4')));

  await expect(page.getByTestId('no-audio-track-notice')).toContainText('separate audio file');
  const input = page.getByTestId('transcription-audio-input');
  const audio = { name: 'dialogue.wav', mimeType: 'audio/wav', buffer: Buffer.from('audio') };
  await input.setInputFiles(audio);
  await expect(page.getByText('dialogue.wav')).toBeVisible();
  await expect(page.getByText(/Match the video's timing from 0:00/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('dialogue.wav')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose separate audio' })).toBeVisible();
  await input.setInputFiles(audio);
  await expect(page.getByText('dialogue.wav')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await bootEditor(page);
  await setVideoBytes(page, await readFile(path.join(__dirname, 'fixtures/no-audio-sample.mp4')));
  await expect(page.getByRole('button', { name: 'Choose separate audio' })).toBeVisible();
  await expect(page.getByText('dialogue.wav')).toHaveCount(0);
});
