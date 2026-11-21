import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AutomationRelay } from '@mcp/infrastructure/AutomationRelay';
import { FileDestinations } from '@mcp/infrastructure/FileDestinations';
import { LoopbackEditorServer } from '@mcp/infrastructure/LoopbackEditorServer';
import { MediaShelf } from '@mcp/infrastructure/MediaShelf';

const TOKEN = 'a-session-token-of-some-length';

/** The page's side of the channel, as the editor's automation bridge speaks it. */
class FakePage {
  private readonly decoder = new TextDecoder();
  private buffer = '';

  constructor(private readonly origin: string) {}

  async connect(): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const response = await fetch(`${this.origin}/automation/calls?session=${TOKEN}`);
    if (response.body === null) throw new Error('no stream');
    return response.body.getReader();
  }

  /** Reads the next call sent down the stream. */
  async nextCall(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{ id: number; method: string; params: unknown }> {
    for (;;) {
      const event = /data: (.*)\n\n/.exec(this.buffer);
      if (event !== null) {
        this.buffer = this.buffer.slice(event.index + event[0].length);
        return JSON.parse(event[1] ?? '{}');
      }
      const { value } = await reader.read();
      this.buffer += this.decoder.decode(value);
    }
  }

  async answer(body: unknown): Promise<void> {
    await fetch(`${this.origin}/automation/answers?session=${TOKEN}`, { method: 'POST', body: JSON.stringify(body) });
  }
}

/** A GET with the Host header of our choosing, which `fetch` does not allow. */
function getWithHost(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    request(url, { headers: { host } }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    }).on('error', reject).end();
  });
}

describe('LoopbackEditorServer', () => {
  let folder: string;
  let relay: AutomationRelay;
  let files: FileDestinations;
  let media: MediaShelf;
  let server: LoopbackEditorServer;
  let origin: string;

  beforeEach(async () => {
    folder = mkdtempSync(path.join(tmpdir(), 'loopback-editor-'));
    const dist = path.join(folder, 'dist');
    mkdirSync(path.join(dist, 'assets'), { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<html>editor</html>');
    writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
    relay = new AutomationRelay();
    files = new FileDestinations();
    media = new MediaShelf();
    server = new LoopbackEditorServer({ distDir: dist, basePath: '/app/' }, TOKEN, relay, files, media, 0);
    await server.start();
    origin = new URL(server.editorUrl('editor')).origin;
  });

  afterEach(() => server.stop());

  it('serves the editor on every route under its base path, cross-origin isolated', async () => {
    const route = await fetch(`${origin}/app/local/project/123`);
    const asset = await fetch(`${origin}/app/assets/app.js`);

    expect(await route.text()).toBe('<html>editor</html>');
    expect(route.headers.get('cross-origin-embedder-policy')).toBe('credentialless');
    expect(route.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(await asset.text()).toBe('console.log(1)');
  });

  it('serves nothing outside the build\'s folder, not even from a folder named as it begins', async () => {
    const sibling = path.join(folder, 'dist-private');
    mkdirSync(sibling);
    writeFileSync(path.join(sibling, 'key.txt'), 'private');
    const response = await fetch(`${origin}/app/..%2Fdist-private%2Fkey.txt`);
    expect(await response.text()).toBe('<html>editor</html>');
  });

  it('carries a call to the page and the page\'s answer back', async () => {
    const page = new FakePage(origin);
    const reader = await page.connect();
    await relay.connected(1_000);

    const result = relay.call('get_status', { detail: 1 }, 5_000);
    const call = await page.nextCall(reader);
    await page.answer({ id: call.id, ok: true, result: { status: 'ready' } });

    expect(call).toMatchObject({ method: 'get_status', params: { detail: 1 } });
    expect(await result).toEqual({ status: 'ready' });
    await reader.cancel();
  });

  it('rejects a call with the page\'s error', async () => {
    const page = new FakePage(origin);
    const reader = await page.connect();
    await relay.connected(1_000);

    // Caught as it settles: the rejection arrives while the page is still answering.
    const failure = relay.call('export_video', {}, 5_000).then(() => null, (error: unknown) => error);
    const call = await page.nextCall(reader);
    await page.answer({ id: call.id, ok: false, error: { name: 'AutomationCallFailedError', message: 'export_video: no project is ready to export' } });

    expect(await failure).toMatchObject({ name: 'EditorPageCallFailedError', pageErrorName: 'AutomationCallFailedError', message: 'export_video: no project is ready to export' });
    await reader.cancel();
  });

  it('writes the pieces the page sends into the file reserved for them, each at its place', async () => {
    const target = path.join(folder, 'out.bin');
    const id = files.reserve(target);

    await fetch(`${origin}/automation/files?session=${TOKEN}&file=${id}&position=3`, { method: 'POST', body: Uint8Array.from([4, 5]) });
    await fetch(`${origin}/automation/files?session=${TOKEN}&file=${id}&position=0`, { method: 'POST', body: Uint8Array.from([1, 2, 3]) });

    expect(await files.release(id)).toBe(5);
    expect([...readFileSync(target)]).toEqual([1, 2, 3, 4, 5]);
  });

  it('serves a shared file to the page, and nothing that was not shared', async () => {
    const shared = path.join(folder, 'clip.mp4');
    writeFileSync(shared, 'video bytes');

    const response = await fetch(`${origin}${server.mediaUrl(media.share(shared))}`);
    const missing = await fetch(`${origin}/automation/media/not-shared/clip.mp4?session=${TOKEN}`);

    expect(await response.text()).toBe('video bytes');
    expect(missing.status).toBe(404);
  });

  it('refuses the channel without the session token, and any request naming another host', async () => {
    const withoutToken = await fetch(`${origin}/automation/calls?session=wrong`);
    const otherHost = await getWithHost(`${origin}/app/`, 'attacker.example:80');

    expect(withoutToken.status).toBe(403);
    expect(otherHost).toBe(421);
  });
});
