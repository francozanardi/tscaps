import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ListedOperation } from '@mcp/domain/ListedOperation';
import { OperationListFile } from '@mcp/infrastructure/OperationListFile';

const OPERATION: ListedOperation = {
  name: 'set_timing',
  description: 'Set when words and scenes start and end.',
  effect: 'edit',
  inputSchema: { type: 'object', properties: { start: { type: 'number' } } },
};

describe('OperationListFile', () => {
  it('reads back the list it wrote beside the build', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'dist-'));
    new OperationListFile(dist).write([OPERATION]);

    expect(new OperationListFile(dist).read()).toEqual([OPERATION]);
  });

  it('has no list for a build it was never written for, nor for a file it did not write', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'dist-'));
    expect(new OperationListFile(dist).read()).toBeNull();

    writeFileSync(path.join(dist, 'mcp-operations.json'), '{"version":1,"operations":[{"name":"x"}]}');
    expect(new OperationListFile(dist).read()).toBeNull();

    writeFileSync(path.join(dist, 'mcp-operations.json'), '{"version":1,"operations":[');
    expect(new OperationListFile(dist).read()).toBeNull();
  });
});
