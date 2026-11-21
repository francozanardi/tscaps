import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ScriptBundler } from '@mcp/domain/ScriptBundler';

/** What the package is built from. */
export interface McpPackageSources {
  /** The server's entry, `mcp/main.ts`. */
  readonly entry: string;
  /** The built editor, with its operation list beside it. */
  readonly distDir: string;
  /** The package's README. */
  readonly readme: string;
  /** The editor's license, copied into the package where there is one. */
  readonly license: string;
}

/** The fields of the published `package.json` that change from one release to the next. */
export interface McpPackageManifest {
  readonly version: string;
  /** The version range of `playwright-core`, the package's one dependency. */
  readonly playwrightVersion: string;
}

const BIN_NAME = 'tscaps-mcp';

/**
 * Writes the npm package `@tscaps/mcp` to a folder: the bundled server as its one executable, the built editor in
 * `dist/` beside it (where the server looks for it, one level up from the executable), the README and the license.
 * The folder is emptied first, so nothing of an earlier package stays.
 */
export class McpPackageWriter {
  constructor(private readonly bundler: ScriptBundler) {}

  /** Writes the package to `outDir`, replacing what was there. */
  async write(sources: McpPackageSources, manifest: McpPackageManifest, outDir: string): Promise<void> {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(path.join(outDir, 'bin'), { recursive: true });
    const executable = path.join(outDir, 'bin', `${BIN_NAME}.mjs`);
    await this.bundler.bundle(sources.entry, executable);
    chmodSync(executable, 0o755);
    cpSync(sources.distDir, path.join(outDir, 'dist'), { recursive: true });
    cpSync(sources.readme, path.join(outDir, 'README.md'));
    const files = ['bin', 'dist', 'README.md'];
    if (existsSync(sources.license)) {
      cpSync(sources.license, path.join(outDir, 'LICENSE'));
      files.push('LICENSE');
    }
    writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(this.packageJson(manifest, files), null, 2)}\n`);
  }

  private packageJson(manifest: McpPackageManifest, files: ReadonlyArray<string>): Record<string, unknown> {
    return {
      name: '@tscaps/mcp',
      version: manifest.version,
      description: 'Let your coding agent edit videos with tscaps: an MCP server that opens the tscaps editor in your browser and drives it with the editor\'s own operations.',
      keywords: ['mcp', 'model-context-protocol', 'video-editing', 'captions', 'subtitles', 'claude-code', 'codex', 'agent'],
      license: 'AGPL-3.0-only',
      homepage: 'https://github.com/francozanardi/tscaps/tree/main/apps/studio/mcp#readme',
      repository: { type: 'git', url: 'git+https://github.com/francozanardi/tscaps.git', directory: 'apps/studio/mcp' },
      bugs: { url: 'https://github.com/francozanardi/tscaps/issues' },
      type: 'module',
      bin: { [BIN_NAME]: `bin/${BIN_NAME}.mjs` },
      files,
      engines: { node: '>=20' },
      dependencies: { 'playwright-core': manifest.playwrightVersion },
    };
  }
}
