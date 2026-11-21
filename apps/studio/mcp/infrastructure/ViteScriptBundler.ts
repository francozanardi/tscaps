import path from 'node:path';
import { build } from 'vite';
import type { ScriptBundler } from '@mcp/domain/ScriptBundler';

/**
 * {@link ScriptBundler} over Vite's build for Node (its SSR mode): one ES module that Node runs as it is, so the
 * published package needs neither TypeScript nor this repository's path aliases. Every dependency is inlined except
 * Playwright, the package's one dependency, which carries a driver of its own that cannot be inlined.
 */
export class ViteScriptBundler implements ScriptBundler {
  /** `mcpFolder` is what the `@mcp/*` alias names. */
  constructor(private readonly mcpFolder: string) {}

  /** Writes the bundle as an executable script: a Node shebang first. */
  async bundle(entry: string, outfile: string): Promise<void> {
    await build({
      configFile: false,
      logLevel: 'warn',
      resolve: { alias: { '@mcp': this.mcpFolder } },
      ssr: { noExternal: true, target: 'node' },
      build: {
        ssr: entry,
        outDir: path.dirname(outfile),
        emptyOutDir: false,
        target: 'node20',
        minify: false,
        rollupOptions: {
          external: ['@playwright/test'],
          output: {
            // The server only launches Chromium; Playwright's core package does that without the test runner.
            paths: { '@playwright/test': 'playwright-core' },
            format: 'es',
            entryFileNames: path.basename(outfile),
            inlineDynamicImports: true,
            banner: '#!/usr/bin/env node',
          },
        },
      },
    });
  }
}
