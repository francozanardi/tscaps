import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Turns a path an agent gave into an absolute one, and refuses one
 * outside the folders the session may touch: the working directory the
 * agent started the server in, and any root the person added. Links are
 * followed before the check, so a link inside a root that points out of
 * every root is refused too.
 */
export class PathPolicy {
  private readonly roots: ReadonlyArray<string>;

  constructor(
    private readonly workingDirectory: string,
    roots: ReadonlyArray<string>,
  ) {
    this.roots = [workingDirectory, ...roots].map((root) => this.real(path.resolve(root)));
  }

  /** An existing file to read. Throws with a sentence the agent can act on. */
  fileToRead(given: string): string {
    const resolved = this.inside(path.resolve(this.workingDirectory, given), given);
    if (!existsSync(resolved) || !statSync(resolved).isFile()) throw new Error(`There is no file at ${resolved}.`);
    return this.inside(this.real(resolved), resolved);
  }

  /** A file to write, whose folder exists. Throws with a sentence the agent can act on. */
  fileToWrite(given: string): string {
    const resolved = this.inside(path.resolve(this.workingDirectory, given), given);
    const folder = path.dirname(resolved);
    if (!existsSync(folder)) throw new Error(`The folder ${folder} does not exist.`);
    const target = existsSync(resolved) ? this.real(resolved) : path.join(this.real(folder), path.basename(resolved));
    return this.inside(target, resolved);
  }

  /** `candidate` where it lies in a root; throws, naming the path as it was `given`, where it does not. */
  private inside(candidate: string, given: string): string {
    const allowed = this.roots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`));
    if (!allowed) throw new Error(`${given} is outside the folders this server may use (${this.roots.join(', ')}). Start it with --root to add one.`);
    return candidate;
  }

  /** `resolved` with every link along it followed; as it is where nothing is there yet. */
  private real(resolved: string): string {
    return existsSync(resolved) ? realpathSync(resolved) : resolved;
  }
}
