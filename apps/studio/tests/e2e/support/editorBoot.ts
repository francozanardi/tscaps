import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __tscapsE2E?: {
      ready: boolean;
      setVideo: (blob: Blob, opts?: { publishPreview?: boolean }) => Promise<void>;
      setVideoLayout: (width: number, height: number) => void;
      setDocument: (json: unknown) => Promise<void>;
      seekPreview: (sourceTimeSec: number) => void;
      triggerExport: () => Promise<void>;
      lastResult: { blob: Blob; sizeBytes: number; mimeType: string } | { error: string } | undefined;
    };
  }
}

/**
 * Boots the editor route with every API call answered in-browser, so
 * the suite runs identically against builds with and without a
 * backend.
 *
 * Lands on the editor URL itself. The root is not a boot URL for a
 * visitor without a session: it resolves to the project dashboard,
 * which leaves the document for sign-in. The prefix the app is mounted
 * under is read from the server rather than hardcoded, because it
 * differs per distribution.
 */
export async function bootEditor(page: Page): Promise<void> {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 401, body: '' }));
  await page.goto(`${await resolveMountPrefix(page)}/editor?e2e=1`);
  await page.waitForFunction(() => window.__tscapsE2E?.ready === true, null, { timeout: 30_000 });
}

/** Path the app is mounted under, taken from the redirect the server answers the root with; `''` when it is served at the root. */
async function resolveMountPrefix(page: Page): Promise<string> {
  const response = await page.request.get('/', { maxRedirects: 0 });
  const location = response.headers()['location'] ?? '';
  return new URL(location, 'http://mount.invalid').pathname.replace(/\/+$/, '');
}

/** Puts a transcription result into the editor, so a spec can reach the caption UI without running one. */
export async function setDocumentJson(page: Page, documentJson: unknown): Promise<void> {
  await page.evaluate(async (json: unknown) => {
    await window.__tscapsE2E!.setDocument(json);
  }, documentJson);
}

/**
 * Boots the editor with a video, a frame and a transcription in place —
 * everything the caption surface needs to paint.
 */
export async function bootEditorWithCaptions(
  page: Page,
  videoBytes: Buffer,
  documentJson: unknown,
  frame: { width: number; height: number } = { width: 720, height: 1280 },
): Promise<void> {
  await bootEditor(page);
  await page.evaluate(async (byteArray: number[]) => {
    const blob = new Blob([new Uint8Array(byteArray)], { type: 'video/mp4' });
    await window.__tscapsE2E!.setVideo(blob);
  }, Array.from(videoBytes));
  await page.evaluate(({ width, height }) => {
    window.__tscapsE2E!.setVideoLayout(width, height);
  }, frame);
  await setDocumentJson(page, documentJson);
}

export async function setVideoBytes(page: Page, bytes: Buffer): Promise<void> {
  // `publishPreview: false` keeps the store in the real pre-preprocessing
  // state, so only the load-time probe can feed the video facts.
  await page.evaluate(async (byteArray: number[]) => {
    const blob = new Blob([new Uint8Array(byteArray)], { type: 'video/mp4' });
    await window.__tscapsE2E!.setVideo(blob, { publishPreview: false });
  }, Array.from(bytes));
}
