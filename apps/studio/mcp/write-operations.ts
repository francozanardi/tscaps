import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { ListedOperation } from '@mcp/domain/ListedOperation';
import { AutomationRelay } from '@mcp/infrastructure/AutomationRelay';
import { BuiltEditorLocator } from '@mcp/infrastructure/BuiltEditorLocator';
import { FileDestinations } from '@mcp/infrastructure/FileDestinations';
import { LoopbackEditorServer } from '@mcp/infrastructure/LoopbackEditorServer';
import { MediaShelf } from '@mcp/infrastructure/MediaShelf';
import { OperationListFile } from '@mcp/infrastructure/OperationListFile';
import { PlaywrightBrowserLauncher } from '@mcp/infrastructure/PlaywrightBrowserLauncher';
import { EditorSession } from '@mcp/services/EditorSession';
import { BackgroundJobs } from '@mcp/services/BackgroundJobs';
import { PageCalls } from '@mcp/services/PageCalls';

// A build step, run once after the editor is built: opens the built editor in a headless browser, asks it for its
// operations over the automation channel, and writes them beside the build, so the MCP server can offer each one as
// a tool of its own when it starts, before any page is open.

const HERE = path.dirname(fileURLToPath(import.meta.url));

const { values: options } = parseArgs({
  options: {
    dist: { type: 'string', default: path.resolve(HERE, '../dist') },
    base: { type: 'string' },
    editor: { type: 'string', default: 'editor' },
    browser: { type: 'string' },
  },
});

const build = new BuiltEditorLocator().locate(options.dist, options.base ?? null);
if (build === null) throw new Error(`No built editor at ${options.dist}: run pnpm build first.`);
const relay = new AutomationRelay();
const server = new LoopbackEditorServer(build, randomBytes(24).toString('base64url'), relay, new FileDestinations(), new MediaShelf(), 0);
const session = new EditorSession(server, relay, new PlaywrightBrowserLauncher(true, options.browser ?? null), options.editor);

await server.start();
try {
  const operations = (await new PageCalls(session, new BackgroundJobs()).call('list_operations')) as ReadonlyArray<ListedOperation>;
  new OperationListFile(build.distDir).write(operations);
  process.stdout.write(`[tscaps-mcp] wrote ${operations.length} operations beside ${build.distDir}\n`);
} finally {
  await session.end();
}
