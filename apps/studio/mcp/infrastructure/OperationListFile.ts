import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ListedOperation } from '@mcp/domain/ListedOperation';

/** The file's shape, versioned so a list written by another version of this server is not misread. */
interface OperationListContents {
  readonly version: 1;
  readonly operations: ReadonlyArray<ListedOperation>;
}

/**
 * The editor's operations, listed once from the built editor and kept
 * beside it (`mcp-operations.json` in the build's folder), so the server
 * can offer each as a tool of its own before any page is open. A new
 * build empties the folder, so a list never outlives the build it was
 * read from.
 */
export class OperationListFile {
  private readonly file: string;

  constructor(distDir: string) {
    this.file = path.join(distDir, 'mcp-operations.json');
  }

  /** The list, or null when there is none or it is not one this server wrote. */
  read(): ReadonlyArray<ListedOperation> | null {
    if (!existsSync(this.file)) return null;
    try {
      const contents = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<OperationListContents>;
      if (contents.version !== 1 || !Array.isArray(contents.operations)) return null;
      return contents.operations.every((operation) => this.isListed(operation)) ? contents.operations : null;
    } catch {
      // A file cut short or edited by hand is as good as none: the server asks for it to be written again.
      return null;
    }
  }

  write(operations: ReadonlyArray<ListedOperation>): void {
    const contents: OperationListContents = { version: 1, operations };
    writeFileSync(this.file, `${JSON.stringify(contents, null, 2)}\n`);
  }

  private isListed(value: unknown): value is ListedOperation {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate['name'] === 'string'
      && typeof candidate['description'] === 'string'
      && (candidate['effect'] === 'read' || candidate['effect'] === 'edit')
      && typeof candidate['inputSchema'] === 'object' && candidate['inputSchema'] !== null;
  }
}
