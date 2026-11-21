import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { EditorBuild } from '@mcp/domain/EditorBuild';

/**
 * Finds the built editor and the path it was built for. The path is read
 * from the build's own `index.html` (where its scripts load from), so the
 * same server serves a build made for the site root or for a sub-path.
 */
export class BuiltEditorLocator {
  /** The build at `distDir`; null when there is none. */
  locate(distDir: string, basePath: string | null): EditorBuild | null {
    const resolved = path.resolve(distDir);
    const index = path.join(resolved, 'index.html');
    if (!existsSync(index)) return null;
    return { distDir: resolved, basePath: basePath ?? this.basePathOf(readFileSync(index, 'utf8')) };
  }

  private basePathOf(html: string): string {
    const match = /<script[^>]+src="([^"]*\/)assets\//.exec(html);
    return match?.[1] ?? '/';
  }
}
