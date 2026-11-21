import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { EditorBuild } from '@mcp/domain/EditorBuild';
import type { ListedOperation } from '@mcp/domain/ListedOperation';
import { AutomationRelay } from '@mcp/infrastructure/AutomationRelay';
import { BrowserLauncherChooser } from '@mcp/infrastructure/BrowserLauncherChooser';
import { BuiltEditorLocator } from '@mcp/infrastructure/BuiltEditorLocator';
import { ChromiumExecutableFinder } from '@mcp/infrastructure/ChromiumExecutableFinder';
import { FileDestinations } from '@mcp/infrastructure/FileDestinations';
import { LoopbackEditorServer } from '@mcp/infrastructure/LoopbackEditorServer';
import { MediaShelf } from '@mcp/infrastructure/MediaShelf';
import { OperationListFile } from '@mcp/infrastructure/OperationListFile';
import { SdkStdioMcpServer } from '@mcp/infrastructure/SdkStdioMcpServer';
import { BackgroundJobs } from '@mcp/services/BackgroundJobs';
import { EditorSession } from '@mcp/services/EditorSession';
import { JobReport } from '@mcp/services/JobReport';
import { PageCalls } from '@mcp/services/PageCalls';
import { PathPolicy } from '@mcp/services/PathPolicy';
import { ScratchFolder } from '@mcp/services/ScratchFolder';
import { McpServerInstructions } from '@mcp/services/McpServerInstructions';
import { ToolAnswers } from '@mcp/services/ToolAnswers';
import { ToolArguments } from '@mcp/services/ToolArguments';
import { ExportVideoTool } from '@mcp/services/tools/ExportVideoTool';
import { FinishSetupTool } from '@mcp/services/tools/FinishSetupTool';
import { GetStatusTool } from '@mcp/services/tools/GetStatusTool';
import { ListCheckpointsTool } from '@mcp/services/tools/ListCheckpointsTool';
import { MoveInHistoryTool } from '@mcp/services/tools/MoveInHistoryTool';
import { OperationTool } from '@mcp/services/tools/OperationTool';
import { OpenVideoTool } from '@mcp/services/tools/OpenVideoTool';
import { RequestReviewTool } from '@mcp/services/tools/RequestReviewTool';
import { ResolveNotesTool } from '@mcp/services/tools/ResolveNotesTool';
import { ReframeVideoTool } from '@mcp/services/tools/ReframeVideoTool';
import { AddMediaTool } from '@mcp/services/tools/AddMediaTool';
import { LookAtMediaTool } from '@mcp/services/tools/LookAtMediaTool';
import { SaveGraphicPresetTool } from '@mcp/services/tools/SaveGraphicPresetTool';
import { SaveTemplateTool } from '@mcp/services/tools/SaveTemplateTool';
import { SearchHelpTool } from '@mcp/services/tools/SearchHelpTool';
import { RenderFramesTool } from '@mcp/services/tools/RenderFramesTool';
import { SaveProjectTool } from '@mcp/services/tools/SaveProjectTool';
import { TitleCheckpointTool } from '@mcp/services/tools/TitleCheckpointTool';
import { WaitForJobTool } from '@mcp/services/tools/WaitForJobTool';

// The composition root of the tscaps MCP server: an agent starts it over
// standard input and output, and it serves the built editor on loopback,
// opens it in a browser on first need, and drives it over the page's
// automation channel. Only the protocol may write to standard output.

const HERE = path.dirname(fileURLToPath(import.meta.url));
// The port the editor is served on when it is free: the same one every session keeps the page's origin, and with it
// what the browser stored for it.
const PREFERRED_PORT = 47_391;

const { values: options } = parseArgs({
  options: {
    dist: { type: 'string', default: path.resolve(HERE, '../dist') },
    base: { type: 'string' },
    editor: { type: 'string', default: 'editor' },
    headless: { type: 'boolean', default: false },
    browser: { type: 'string' },
    'browser-arg': { type: 'string', multiple: true, default: [] },
    root: { type: 'string', multiple: true, default: [] },
  },
});

const studioFolder = path.resolve(HERE, '..');
const builtEditor = new BuiltEditorLocator().locate(options.dist, options.base ?? null);
const listed = builtEditor === null ? null : new OperationListFile(builtEditor.distDir).read();
if (builtEditor === null || listed === null) {
  // An editor that is not built, or built without its operations listed, cannot be edited: the agent is offered one
  // tool that says what to run, rather than a server that fails to start where only the client's log would say why.
  const problem = builtEditor === null
    ? `the editor is not built (nothing at ${path.resolve(options.dist)}). In ${studioFolder}, run \`pnpm install\`, \`pnpm build\` and \`pnpm mcp:operations\`, then restart this MCP server.`
    : `the built editor at ${builtEditor.distDir} has no list of its operations, which \`pnpm mcp:operations\` writes after every build. In ${studioFolder}, run \`pnpm mcp:operations\`, then restart this MCP server.`;
  process.stderr.write(`[tscaps-mcp] ${problem}\n`);
  const setup = new SdkStdioMcpServer({ name: 'tscaps', version: '0.1.0', instructions: `tscaps is not set up yet: ${problem}` }, [new FinishSetupTool(problem)]);
  await setup.start(() => process.exit(0));
} else {
  await serve(builtEditor, listed);
}

/** Serves the built editor `build`, offering each operation of `listed` as a tool of its own. */
async function serve(build: EditorBuild, listed: ReadonlyArray<ListedOperation>): Promise<void> {
  const token = randomBytes(24).toString('base64url');
  const relay = new AutomationRelay();
  const files = new FileDestinations();
  const media = new MediaShelf();
  const server = new LoopbackEditorServer(build, token, relay, files, media, PREFERRED_PORT);
  const launcher = new BrowserLauncherChooser(new ChromiumExecutableFinder(process.platform, process.env), process.platform, process.env).choose({
    headless: options.headless,
    executable: options.browser ?? null,
    extraArgs: options['browser-arg'],
  });
  const session = new EditorSession(server, relay, launcher, options.editor);
  const paths = new PathPolicy(process.cwd(), options.root);
  const jobs = new BackgroundJobs();
  const pageCalls = new PageCalls(session, jobs);
  const answers = new ToolAnswers();
  const report = new JobReport(answers);
  const args = new ToolArguments();

  const mcp = new SdkStdioMcpServer(
    { name: 'tscaps', version: '0.1.0', instructions: new McpServerInstructions().text() },
    [
      new OpenVideoTool(session, server, media, paths, pageCalls, jobs, report, args),
      new WaitForJobTool(jobs, report, args),
      new GetStatusTool(pageCalls, answers),
      ...listed.map((operation) => new OperationTool(operation, pageCalls, answers)),
      new ReframeVideoTool(pageCalls, jobs, report, args),
      new AddMediaTool(server, media, paths, pageCalls, answers, args),
      new LookAtMediaTool(pageCalls, answers, args),
      new SaveTemplateTool(pageCalls, answers, args),
      new SaveGraphicPresetTool(pageCalls, answers, args),
      new SearchHelpTool(pageCalls, answers, args),
      new RenderFramesTool(pageCalls, files, new ScratchFolder(), args),
      new RequestReviewTool(pageCalls, answers),
      new ResolveNotesTool(pageCalls, answers, args),
      new TitleCheckpointTool(pageCalls, answers, args),
      new ListCheckpointsTool(pageCalls, answers),
      new MoveInHistoryTool(pageCalls, answers, args),
      new SaveProjectTool(pageCalls, files, paths, answers, args),
      new ExportVideoTool(pageCalls, files, paths, jobs, report, args),
    ],
  );

  await server.start();
  process.stderr.write(`[tscaps-mcp] serving ${build.distDir} at ${session.url().split('?')[0]}; the page opens in ${session.whereThePageOpens}\n`);
  const end = (): void => {
    void session.end().finally(() => process.exit(0));
  };
  await mcp.start(end);
  process.on('SIGINT', end);
  process.on('SIGTERM', end);
}
