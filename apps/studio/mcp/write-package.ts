import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { BuiltEditorLocator } from '@mcp/infrastructure/BuiltEditorLocator';
import { ViteScriptBundler } from '@mcp/infrastructure/ViteScriptBundler';
import { McpPackageWriter } from '@mcp/infrastructure/McpPackageWriter';
import { OperationListFile } from '@mcp/infrastructure/OperationListFile';

// A release step, run after `pnpm build` and `pnpm mcp:operations`: writes the npm package `@tscaps/mcp` to a
// folder, ready for `npm publish`. The package carries the built editor, so whoever installs it builds nothing.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const studio = path.resolve(HERE, '..');

const { values: options } = parseArgs({
  options: {
    dist: { type: 'string', default: path.join(studio, 'dist') },
    out: { type: 'string', default: path.join(studio, 'mcp-package') },
  },
});

const build = new BuiltEditorLocator().locate(options.dist, null);
if (build === null) throw new Error(`No built editor at ${options.dist}: run pnpm build first.`);
if (new OperationListFile(build.distDir).read() === null) {
  throw new Error(`The built editor at ${build.distDir} has no operation list: run pnpm mcp:operations first.`);
}
const studioManifest = JSON.parse(readFileSync(path.join(studio, 'package.json'), 'utf8')) as {
  version: string;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
};
const playwrightVersion = studioManifest.devDependencies?.['@playwright/test'] ?? studioManifest.dependencies?.['@playwright/test'];
if (playwrightVersion === undefined) throw new Error('The editor\'s package.json names no @playwright/test to match.');

await new McpPackageWriter(new ViteScriptBundler(HERE)).write(
  {
    entry: path.join(HERE, 'main.ts'),
    distDir: build.distDir,
    readme: path.join(HERE, 'package-readme.md'),
    license: path.join(studio, 'LICENSE'),
  },
  { version: studioManifest.version, playwrightVersion },
  options.out,
);
process.stdout.write(`[tscaps-mcp] wrote @tscaps/mcp ${studioManifest.version} to ${options.out}\n`);
