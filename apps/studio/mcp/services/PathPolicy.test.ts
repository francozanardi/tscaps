import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PathPolicy } from '@mcp/services/PathPolicy';

function folders(): { work: string; extra: string; outside: string } {
  const base = mkdtempSync(path.join(tmpdir(), 'path-policy-'));
  const work = path.join(base, 'work');
  const extra = path.join(base, 'extra');
  const outside = path.join(base, 'outside');
  for (const folder of [work, extra, outside]) mkdirSync(folder);
  writeFileSync(path.join(work, 'clip.mp4'), '');
  writeFileSync(path.join(extra, 'clip.mp4'), '');
  writeFileSync(path.join(outside, 'clip.mp4'), '');
  return { work, extra, outside };
}

describe('PathPolicy', () => {
  it('resolves a relative path against the working directory', () => {
    const { work } = folders();

    expect(new PathPolicy(work, []).fileToRead('clip.mp4')).toBe(path.join(work, 'clip.mp4'));
  });

  it('allows a folder added as a root, and refuses one outside every root, however the path is written', () => {
    const { work, extra, outside } = folders();
    const policy = new PathPolicy(work, [extra]);

    expect(policy.fileToRead(path.join(extra, 'clip.mp4'))).toBe(path.join(extra, 'clip.mp4'));
    expect(() => policy.fileToRead(path.join(outside, 'clip.mp4'))).toThrow(/outside the folders/);
    expect(() => policy.fileToRead('../outside/clip.mp4')).toThrow(/outside the folders/);
    expect(() => policy.fileToRead(`${work}-sibling/clip.mp4`)).toThrow(/outside the folders/);
  });

  it('says a file to read is missing, and a file to write needs its folder', () => {
    const { work } = folders();
    const policy = new PathPolicy(work, []);

    expect(() => policy.fileToRead('missing.mp4')).toThrow(/There is no file/);
    expect(policy.fileToWrite('out.mp4')).toBe(path.join(work, 'out.mp4'));
    expect(() => policy.fileToWrite('new-folder/out.mp4')).toThrow(/does not exist/);
  });

  it('follows links before the check, so a link inside a root that points out of every root is refused', () => {
    const { work, outside } = folders();
    symlinkSync(path.join(outside, 'clip.mp4'), path.join(work, 'linked.mp4'));
    symlinkSync(outside, path.join(work, 'linked-folder'));
    const policy = new PathPolicy(work, []);

    expect(() => policy.fileToRead('linked.mp4')).toThrow(/outside the folders/);
    expect(() => policy.fileToWrite('linked.mp4')).toThrow(/outside the folders/);
    expect(() => policy.fileToWrite('linked-folder/out.mp4')).toThrow(/outside the folders/);
  });
});
