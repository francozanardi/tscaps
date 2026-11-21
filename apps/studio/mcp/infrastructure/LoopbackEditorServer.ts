// Node's http API names its response type ServerResponse. banned-words-allow-file: server-prefixed identifier
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import type { EditorBuild } from '@mcp/domain/EditorBuild';
import type { EditorServer } from '@mcp/domain/EditorServer';
import type { AutomationRelay } from '@mcp/infrastructure/AutomationRelay';
import type { FileDestinations } from '@mcp/infrastructure/FileDestinations';
import type { MediaShelf } from '@mcp/infrastructure/MediaShelf';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.gif': 'image/gif', '.webp': 'image/webp', '.txt': 'text/plain',
  '.srt': 'text/plain', '.vtt': 'text/vtt', '.onnx': 'application/octet-stream',
};

/** The largest body a POST from the page may carry: an export is sent in pieces far smaller. */
const MAX_BODY_BYTES = 64 * 1024 * 1024;

/**
 * The HTTP server the editor page and its channel are served from, on
 * the loopback interface only, at a port the system picks. It serves the
 * built editor (any path without a file is the editor's own route, as a
 * static host's fallback does), the files shared with the page, and the
 * channel's routes: calls, answers and file pieces. Everything but the editor's static files needs
 * the session's token, and every request must name this server as its
 * host, which keeps out other pages a browser on this machine may hold.
 * Every response carries the headers that make the page
 * cross-origin isolated, which in-browser transcription needs.
 */
export class LoopbackEditorServer implements EditorServer {
  private readonly server: Server;
  private port = 0;

  constructor(
    private readonly build: EditorBuild,
    private readonly token: string,
    private readonly relay: AutomationRelay,
    private readonly files: FileDestinations,
    private readonly media: MediaShelf,
    private readonly preferredPort: number,
  ) {
    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error: unknown) => {
        if (!response.headersSent) response.writeHead(500);
        response.end();
        process.stderr.write(`[tscaps-mcp] ${request.method} ${request.url?.split('?')[0]} failed: ${String(error)}\n`);
      });
    });
  }

  /**
   * Listens on loopback: on `preferredPort` (0 for any), or on any free
   * port while it is taken. The same port from one session to the next
   * keeps the page on one origin, and with it what the browser stores for
   * that origin: the person's own templates and graphic presets, the
   * editor's projects.
   */
  async start(): Promise<void> {
    if (!(await this.listenOn(this.preferredPort))) await this.listenOn(0);
    this.port = (this.server.address() as AddressInfo).port;
  }

  /** Whether listening on `port` succeeded; false when it is taken, rejects on any other failure. */
  private listenOn(port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const failed = (error: NodeJS.ErrnoException): void => {
        if (error.code === 'EADDRINUSE') resolve(false);
        else reject(error);
      };
      this.server.once('error', failed);
      this.server.listen(port, '127.0.0.1', () => {
        this.server.off('error', failed);
        resolve(true);
      });
    });
  }

  /** The URL that opens the editor route `editorRoute` (relative to the base path) for this session. */
  editorUrl(editorRoute: string): string {
    return `http://127.0.0.1:${this.port}${this.build.basePath}${editorRoute}?automation=${this.token}`;
  }

  /** The URL the page reads a shared file from. */
  mediaUrl(mediaPath: string): string {
    return `${mediaPath}?session=${this.token}`;
  }

  stop(): void {
    this.relay.close();
    this.server.closeAllConnections();
    this.server.close();
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const host = request.headers.host ?? '';
    if (host !== `127.0.0.1:${this.port}` && host !== `localhost:${this.port}`) {
      response.writeHead(421).end();
      return;
    }
    const url = new URL(request.url ?? '/', `http://${host}`);
    if (url.pathname.startsWith('/automation/')) {
      await this.handleChannel(url, request, response);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    this.serveEditor(url.pathname, response);
  }

  private async handleChannel(url: URL, request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.carriesToken(url)) {
      response.writeHead(403).end();
      return;
    }
    const route = url.pathname.slice('/automation/'.length);
    if (route === 'calls' && request.method === 'GET') {
      this.relay.attach(response);
      return;
    }
    if (route === 'answers' && request.method === 'POST') {
      const body = await this.readBody(request);
      this.relay.settle(JSON.parse(body.toString('utf8')));
      response.writeHead(204).end();
      return;
    }
    if (route === 'files' && request.method === 'POST') {
      const body = await this.readBody(request);
      await this.files.write(url.searchParams.get('file') ?? '', Number(url.searchParams.get('position') ?? '0'), body);
      response.writeHead(204).end();
      return;
    }
    if (route.startsWith('media/') && request.method === 'GET') {
      const filePath = this.media.find(route.split('/')[1] ?? '');
      if (filePath === null) {
        response.writeHead(404).end();
        return;
      }
      this.sendFile(filePath, response, {});
      return;
    }
    response.writeHead(404).end();
  }

  private carriesToken(url: URL): boolean {
    const given = Buffer.from(url.searchParams.get('session') ?? '');
    const expected = Buffer.from(this.token);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  private serveEditor(pathname: string, response: ServerResponse): void {
    const { distDir, basePath } = this.build;
    if (!pathname.startsWith(basePath) && `${pathname}/` !== basePath) {
      response.writeHead(302, { location: basePath }).end();
      return;
    }
    const relative = decodeURIComponent(pathname.slice(basePath.length));
    let file = path.join(distDir, relative);
    if (!this.insideBuild(file) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    this.sendFile(file, response, {
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'credentialless',
      'cache-control': file.endsWith('index.html') ? 'no-store' : 'max-age=3600',
    });
  }

  /** Whether `file` lies in the build's folder: a sibling whose name starts as the folder's does not. */
  private insideBuild(file: string): boolean {
    const relative = path.relative(this.build.distDir, file);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  private sendFile(file: string, response: ServerResponse, headers: Readonly<Record<string, string>>): void {
    response.writeHead(200, {
      ...headers,
      'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': statSync(file).size,
    });
    createReadStream(file).pipe(response);
  }

  private readBody(request: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new Error('body too large'));
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks)));
      request.on('error', reject);
    });
  }
}
