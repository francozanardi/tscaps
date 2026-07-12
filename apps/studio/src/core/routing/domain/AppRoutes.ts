/**
 * Builds URL paths for an app tree mounted under a path prefix — the
 * root tree passes `''`, a tree mounted under a sub-path passes its
 * prefix (`'/local'`). Two flavours:
 *
 * - `editor()` / `project(id)` produce concrete navigation URLs.
 * - `projectPattern()` returns the router-style pattern (`:id`) used
 *   when registering routes — the only place a literal `:id` belongs.
 */
export class AppRoutes {
  constructor(private readonly prefix: string) {}

  landing(): string {
    return this.prefix || '/';
  }

  projectsList(): string {
    return `${this.prefix}/projects`;
  }

  editor(): string {
    return `${this.prefix}/editor`;
  }


  project(projectId: string): string {
    return `${this.prefix}/project/${projectId}`;
  }

  projectPattern(): string {
    return `${this.prefix}/project/:id`;
  }

  toolPattern(): string {
    return `${this.prefix}/editor/tools/:slug`;
  }
}
